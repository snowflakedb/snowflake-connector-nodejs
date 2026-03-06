import { DetailedPeerCertificate } from 'tls';
import crypto from 'crypto';
import asn1 from 'asn1.js';
import rfc5280 from 'asn1.js-rfc5280';
import {
  ALGORITHM_OIDS,
  parseRSASSAPSSParams,
  AlgorithmIdentifierEntity,
  RSASSAPSSParamsEntity,
} from '../../../lib/agent/rsassa_pss';

const DEFAULT_SIGNATURE_ALGORITHM_OID = '1.2.840.113549.1.1.11';

const SIGNATURE_OID_TO_DIGEST: Record<string, string> = {
  '1.2.840.113549.1.1.11': 'sha256',
  '1.2.840.113549.1.1.12': 'sha384',
  '1.2.840.113549.1.1.13': 'sha512',
  '1.2.840.10045.4.3.2': 'sha256',
  '1.2.840.10045.4.3.3': 'sha384',
  '1.2.840.10045.4.3.4': 'sha512',
};
let serialNumberCounter = 10000;

export function createCertificateKeyPair(algorithmOid = DEFAULT_SIGNATURE_ALGORITHM_OID) {
  // RSA (PKCS#1 v1.5 and RSASSA-PSS both use standard RSA key pairs)
  if (algorithmOid.startsWith('1.2.840.113549.1.1.')) {
    // PSS needs large keys due to padding overhead (hashLen + saltLen + 2 bytes), use 2048.
    // SHA-384/512 PKCS#1 v1.5 also need keys larger than 512-bit to fit the digest + padding.
    const digest = SIGNATURE_OID_TO_DIGEST[algorithmOid];
    const isPSS = algorithmOid === ALGORITHM_OIDS.RSASSA_PSS;
    const needsLargerKey = isPSS || digest === 'sha384' || digest === 'sha512';
    const minModulusLength = isPSS ? 2048 : needsLargerKey ? 1024 : 512;
    const pair = crypto.generateKeyPairSync('rsa', {
      modulusLength: crypto.getFips() ? 2048 : minModulusLength, // faster test runs
      publicExponent: 0x10001,
    });
    return {
      ...pair,
      publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }) as string,
    };
  }

  // ECDSA
  if (algorithmOid.startsWith('1.2.840.10045.4.3.')) {
    const algorithm = SIGNATURE_OID_TO_DIGEST[algorithmOid];
    if (!algorithm) {
      throw new Error(`Unsupported ECDSA algorithm OID: ${algorithmOid}`);
    }
    let namedCurve: string;
    if (algorithm === 'sha256') {
      namedCurve = 'prime256v1'; // P-256
    } else if (algorithm === 'sha384') {
      namedCurve = 'secp384r1'; // P-384
    } else if (algorithm === 'sha512') {
      namedCurve = 'secp521r1'; // P-521
    } else {
      namedCurve = 'prime256v1'; // Default to P-256
    }

    const pair = crypto.generateKeyPairSync('ec', { namedCurve });
    return {
      ...pair,
      publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }) as string,
    };
  }

  throw new Error(`Unsupported algorithm OID: ${algorithmOid}`);
}

export function createCertificateNameField(
  options: {
    organizationName?: string;
    commonName?: string;
    countryName?: string;
    stateOrProvinceName?: string;
    localityName?: string;
    organizationalUnitName?: string;
  } = {},
): rfc5280.NameRDNSequence {
  const {
    organizationName = 'Test Organization',
    commonName = 'Common Name',
    countryName = 'US',
    stateOrProvinceName = 'California',
    localityName = 'San Francisco',
    organizationalUnitName = 'Engineering',
  } = options;

  const fields = [
    [countryName, [2, 5, 4, 6]],
    [stateOrProvinceName, [2, 5, 4, 8]],
    [localityName, [2, 5, 4, 7]],
    [organizationName, [2, 5, 4, 10]],
    [organizationalUnitName, [2, 5, 4, 11]],
    [commonName, [2, 5, 4, 3]],
  ] as const;

  return {
    type: 'rdnSequence',
    value: fields.map(([value, oid]) => [
      {
        type: oid,
        value: [19, value.length, ...Array.from(Buffer.from(value, 'utf8'))],
      },
    ]),
  };
}

type TestCertificateCrlDistributionPointValue = string | { type: string; value: string } | null;

export function buildPSSAlgorithmIdentifier(hashOidStr: string | null = null, saltLength = 32) {
  const hashOid = hashOidStr ? hashOidStr.split('.').map(Number) : null;

  const pssParams: Record<string, unknown> = {};
  if (hashOid) {
    pssParams.hashAlgorithm = { algorithm: hashOid, parameters: Buffer.from([0x05, 0x00]) };
    const hashAlgId = AlgorithmIdentifierEntity.encode(
      { algorithm: hashOid, parameters: Buffer.from([0x05, 0x00]) },
      'der',
    );
    pssParams.maskGenAlgorithm = {
      algorithm: ALGORITHM_OIDS.MGF1.split('.').map(Number),
      parameters: hashAlgId,
    };
  }
  pssParams.saltLength = new asn1.bignum(saltLength);
  pssParams.trailerField = new asn1.bignum(1);

  return {
    algorithm: ALGORITHM_OIDS.RSASSA_PSS.split('.').map(Number),
    parameters: RSASSAPSSParamsEntity.encode(pssParams, 'der'),
  };
}

export function createTestCertificate(
  options: {
    serialNumber?: number;
    notBefore?: string;
    notAfter?: string;
    subject?: rfc5280.NameRDNSequence;
    keyPair?: crypto.KeyPairKeyObjectResult;
    signatureAlgorithmOid?: string;
    crlDistributionPoints?: (
      | TestCertificateCrlDistributionPointValue
      | TestCertificateCrlDistributionPointValue[]
    )[];
  } = {},
): rfc5280.CertificateDecoded {
  const serialNumber = options.serialNumber ?? serialNumberCounter++;
  const notBefore = options.notBefore ?? '2026-01-01T00:00:00Z';
  const notAfter = options.notAfter ?? '2026-12-31T00:00:00Z';
  const subject = options.subject ?? createCertificateNameField();
  const signatureAlgorithmOid = options.signatureAlgorithmOid ?? DEFAULT_SIGNATURE_ALGORITHM_OID;
  const keyPair = options.keyPair ?? createCertificateKeyPair(signatureAlgorithmOid);

  const signatureAlgorithm =
    signatureAlgorithmOid === ALGORITHM_OIDS.RSASSA_PSS
      ? buildPSSAlgorithmIdentifier(ALGORITHM_OIDS.SHA256)
      : {
          algorithm: signatureAlgorithmOid.split('.').map(Number),
          parameters: Buffer.from([0x05, 0x00]),
        };

  const extensions: rfc5280.TBSCertificate['extensions'] = [];
  if (options.crlDistributionPoints) {
    extensions.push({
      extnID: 'cRLDistributionPoints',
      extnValue: options.crlDistributionPoints.map((crlDistributionPoint) => {
        const values = Array.isArray(crlDistributionPoint)
          ? crlDistributionPoint
          : [crlDistributionPoint];
        return crlDistributionPoint === null
          ? {}
          : {
              distributionPoint: {
                type: 'fullName',
                value: values.map((value) => {
                  if (typeof value === 'string') {
                    return { type: 'uniformResourceIdentifier', value };
                  }
                  return value;
                }),
              },
            };
      }),
    });
  }

  return {
    tbsCertificate: {
      version: 'v3',
      serialNumber: new asn1.bignum(serialNumber),
      signature: signatureAlgorithm,
      issuer: createCertificateNameField({
        commonName: 'Issuer',
      }),
      validity: {
        notBefore: { type: 'utcTime', value: new Date(notBefore).getTime() },
        notAfter: { type: 'utcTime', value: new Date(notAfter).getTime() },
      },
      subject,
      subjectPublicKeyInfo: rfc5280.SubjectPublicKeyInfo.decode(
        keyPair.publicKey.export({ type: 'spki', format: 'der' }),
        'der',
      ),
      extensions,
    },
    signatureAlgorithm,
    signature: { unused: 0, data: Buffer.from([0]) },
  };
}

export function createTestCRL(
  options: {
    issuerCertificate?: rfc5280.CertificateDecoded;
    issuerKeyPair?: crypto.KeyPairKeyObjectResult;
    signatureAlgorithmOid?: string;
    issuingDistributionPointUrls?: string[];
    nextUpdate?: number;
    revokedCertificates?: number[];
  } = {},
): rfc5280.CertificateListDecoded {
  const signatureAlgorithmOid = options.signatureAlgorithmOid ?? DEFAULT_SIGNATURE_ALGORITHM_OID;
  const issuerKeyPair = options.issuerKeyPair ?? createCertificateKeyPair(signatureAlgorithmOid);
  const issuerCertificate =
    options.issuerCertificate ??
    createTestCertificate({
      keyPair: issuerKeyPair,
      signatureAlgorithmOid,
    });
  const issuingDistributionPointUrls = options.issuingDistributionPointUrls ?? null;
  const revokedCertificates = options.revokedCertificates ?? ['0'];
  const nextUpdate = options.nextUpdate ?? new Date('2026-06-08T00:00:00Z').getTime();

  const tbsCertList: rfc5280.TBSCertList = {
    version: new asn1.bignum(1),
    signature: issuerCertificate.signatureAlgorithm,
    issuer: issuerCertificate.tbsCertificate.subject,
    thisUpdate: { type: 'utcTime', value: new Date('2026-06-01T00:00:00Z').getTime() },
    nextUpdate: { type: 'utcTime', value: nextUpdate },
    revokedCertificates: revokedCertificates.map((serialNumber) => ({
      userCertificate: new asn1.bignum(serialNumber),
      revocationDate: {
        type: 'utcTime' as const,
        value: new Date('2026-06-01T00:00:00Z').getTime(),
      },
    })),
    crlExtensions: issuingDistributionPointUrls
      ? [
          {
            extnID: 'issuingDistributionPoint',
            extnValue: {
              distributionPoint: {
                type: 'fullName',
                value: issuingDistributionPointUrls.map((url) => ({
                  type: 'uniformResourceIdentifier',
                  value: url,
                })),
              },
            },
          },
        ]
      : [],
  };

  const signatureOid = issuerCertificate.signatureAlgorithm.algorithm.join('.');
  const tbsEncoded = rfc5280.TBSCertList.encode(tbsCertList, 'der');

  let signature: Buffer;
  if (signatureOid === ALGORITHM_OIDS.RSASSA_PSS) {
    const pssParams = parseRSASSAPSSParams(issuerCertificate.signatureAlgorithm.parameters);
    signature = crypto.sign(pssParams.hashAlgorithm, tbsEncoded, {
      key: issuerKeyPair.privateKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: pssParams.saltLength,
    });
  } else {
    const digestAlgorithm = SIGNATURE_OID_TO_DIGEST[signatureOid];
    const sign = crypto.createSign(digestAlgorithm);
    sign.update(tbsEncoded);
    signature = sign.sign(issuerKeyPair.privateKey);
  }

  const crl = {
    tbsCertList,
    signatureAlgorithm: issuerCertificate.signatureAlgorithm,
    signature: { unused: 0, data: signature },
  };
  // Encoding + Decoding to ensure all fields are set correctly
  return rfc5280.CertificateList.decode(rfc5280.CertificateList.encode(crl, 'der'), 'der');
}

export function createCertificateChain(...chain: rfc5280.CertificateDecoded[]) {
  const certificates = chain.map((cert, i) => {
    const id = `CERT#${i + 1}`;
    return {
      subject: {
        O: id,
        CN: id,
      },
      serialNumber: id,
      pubkey: rfc5280.SubjectPublicKeyInfo.encode(cert.tbsCertificate.subjectPublicKeyInfo, 'der'),
      raw: Buffer.from(rfc5280.Certificate.encode(cert, 'der')),
    };
  }) as DetailedPeerCertificate[];

  for (let i = 0; i < certificates.length; i++) {
    const cert = certificates[i];
    const issuer = certificates[i + 1] || cert;
    cert.issuerCertificate = issuer;
  }
  return certificates[0];
}
