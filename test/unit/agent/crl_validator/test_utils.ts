import { DetailedPeerCertificate } from 'tls';
import crypto from 'crypto';
import asn1 from 'asn1.js';
import rfc5280 from 'asn1.js-rfc5280';
import { ALGORITHM_OID } from '../../../../lib/agent/crl_validator/oids';

let serialNumberCounter = 10000;

const CRL_SIGNATURE_OID_TO_DIGEST: Record<string, string> = {
  [ALGORITHM_OID.SHA256_WITH_RSA]: 'sha256',
  [ALGORITHM_OID.SHA384_WITH_RSA]: 'sha384',
  [ALGORITHM_OID.SHA512_WITH_RSA]: 'sha512',
  [ALGORITHM_OID.ECDSA_WITH_SHA256]: 'sha256',
  [ALGORITHM_OID.ECDSA_WITH_SHA384]: 'sha384',
  [ALGORITHM_OID.ECDSA_WITH_SHA512]: 'sha512',
};

export function createCertificateKeyPair(algorithmOid = ALGORITHM_OID.SHA256_WITH_RSA) {
  // RSA
  if (algorithmOid.startsWith('1.2.840.113549.1.1.')) {
    const pair = crypto.generateKeyPairSync('rsa', {
      modulusLength: crypto.getFips() ? 2048 : 512, // faster test runs
      publicExponent: 0x10001,
    });
    return {
      ...pair,
      publicKeyPem: pair.publicKey.export({ type: 'spki', format: 'pem' }) as string,
    };
  }

  // ECDSA
  if (algorithmOid.startsWith('1.2.840.10045.4.3.')) {
    let namedCurve: string;
    if (algorithmOid === ALGORITHM_OID.ECDSA_WITH_SHA256) {
      namedCurve = 'prime256v1'; // P-256
    } else if (algorithmOid === ALGORITHM_OID.ECDSA_WITH_SHA384) {
      namedCurve = 'secp384r1'; // P-384
    } else if (algorithmOid === ALGORITHM_OID.ECDSA_WITH_SHA512) {
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

  throw new Error(`Unsupported algorithm: ${algorithmOid}`);
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
  const signatureAlgorithmOid = options.signatureAlgorithmOid ?? ALGORITHM_OID.SHA256_WITH_RSA;
  const keyPair = options.keyPair ?? createCertificateKeyPair(signatureAlgorithmOid);

  const signatureAlgorithm = {
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
    issuingDistributionPointUrls?: string[];
    nextUpdate?: number;
    revokedCertificates?: number[];
  } = {},
): rfc5280.CertificateListDecoded {
  const issuerKeyPair = options.issuerKeyPair ?? createCertificateKeyPair();
  const issuerCertificate =
    options.issuerCertificate ?? createTestCertificate({ keyPair: issuerKeyPair });
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
  const digestAlgorithm = CRL_SIGNATURE_OID_TO_DIGEST[signatureOid];

  const sign = crypto.createSign(digestAlgorithm);
  sign.update(rfc5280.TBSCertList.encode(tbsCertList, 'der'));
  const signature = sign.sign(issuerKeyPair.privateKey);

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
