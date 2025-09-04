import { DetailedPeerCertificate } from 'tls';
import crypto from 'crypto';
import ASN1 from 'asn1.js-rfc5280';
import BN from 'bn.js';
import { SUPPORTED_CRL_VERIFICATION_ALGORITHMS } from '../../../lib/agent/crl_utils';

const DEFAULT_SIGNATURE_ALGORITHM_OID = '1.2.840.113549.1.1.11';
let serialNumberCounter = 10000;

export function createCertificateKeyPair(algorithmOid = DEFAULT_SIGNATURE_ALGORITHM_OID) {
  const algorithm = SUPPORTED_CRL_VERIFICATION_ALGORITHMS[algorithmOid];
  if (!algorithm) {
    throw new Error(`Unsupported algorithm OID: ${algorithmOid}`);
  }

  // RSA
  if (algorithmOid.startsWith('1.2.840.113549.1.1.')) {
    const pair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 512,
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
    if (algorithm.includes('SHA256')) {
      namedCurve = 'prime256v1'; // P-256
    } else if (algorithm.includes('SHA384')) {
      namedCurve = 'secp384r1'; // P-384
    } else if (algorithm.includes('SHA512')) {
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

  throw new Error(`Unsupported algorithm: ${algorithm}`);
}

export function createTestCertificate(
  options: {
    serialNumber?: number;
    notBefore?: string;
    notAfter?: string;
    keyPair?: crypto.KeyPairKeyObjectResult;
    signatureAlgorithmOid?: string;
    crlUrls?: string[];
    extensions?: ASN1.TBSCertificate['extensions'];
  } = {},
): ASN1.CertificateDecoded {
  const serialNumber = options.serialNumber ?? serialNumberCounter++;
  const notBefore = options.notBefore ?? '2026-01-01T00:00:00Z';
  const notAfter = options.notAfter ?? '2026-12-31T00:00:00Z';
  const signatureAlgorithmOid = options.signatureAlgorithmOid ?? DEFAULT_SIGNATURE_ALGORITHM_OID;
  const keyPair = options.keyPair ?? createCertificateKeyPair(signatureAlgorithmOid);

  const signatureAlgorithm = {
    algorithm: signatureAlgorithmOid.split('.').map(Number),
    parameters: Buffer.from([0x05, 0x00]),
  };

  const extensions = options.extensions ?? [];
  if (options.crlUrls) {
    extensions.push({
      extnID: 'cRLDistributionPoints',
      extnValue: [
        {
          distributionPoint: {
            type: 'fullName',
            value: options.crlUrls.map((url) => ({
              type: 'uniformResourceIdentifier',
              value: url,
            })),
          },
        },
      ],
    });
  }

  return {
    tbsCertificate: {
      version: 'v3',
      serialNumber: new BN(serialNumber),
      signature: signatureAlgorithm,
      issuer: {
        type: 'rdnSequence',
        value: [],
      },
      validity: {
        notBefore: { type: 'utcTime', value: new Date(notBefore).getTime() },
        notAfter: { type: 'utcTime', value: new Date(notAfter).getTime() },
      },
      subject: {
        type: 'rdnSequence',
        value: [],
      },
      subjectPublicKeyInfo: ASN1.SubjectPublicKeyInfo.decode(
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
    issuerCertificate?: ASN1.CertificateDecoded;
    issuerKeyPair?: crypto.KeyPairKeyObjectResult;
    revokedCertificates?: number[];
  } = {},
): ASN1.CertificateListDecoded {
  const issuerKeyPair = options.issuerKeyPair ?? createCertificateKeyPair();
  const issuerCertificate =
    options.issuerCertificate ?? createTestCertificate({ keyPair: issuerKeyPair });
  const revokedCertificates = options.revokedCertificates ?? ['0'];

  const tbsCertList: ASN1.TBSCertList = {
    version: new BN(1),
    signature: issuerCertificate.signatureAlgorithm,
    issuer: issuerCertificate.tbsCertificate.issuer,
    thisUpdate: { type: 'utcTime', value: new Date('2026-06-01T00:00:00Z').getTime() },
    nextUpdate: { type: 'utcTime', value: new Date('2026-06-08T00:00:00Z').getTime() },
    revokedCertificates: revokedCertificates.map((serialNumber) => ({
      userCertificate: new BN(serialNumber),
      revocationDate: {
        type: 'utcTime' as const,
        value: new Date('2026-06-01T00:00:00Z').getTime(),
      },
    })),
  };

  const signatureOid = issuerCertificate.signatureAlgorithm.algorithm.join('.');
  const signatureAlgorithm = SUPPORTED_CRL_VERIFICATION_ALGORITHMS[signatureOid];

  const sign = crypto.createSign(signatureAlgorithm);
  sign.update(ASN1.TBSCertList.encode(tbsCertList, 'der'));
  const signature = sign.sign(issuerKeyPair.privateKey);

  return {
    tbsCertList,
    signatureAlgorithm: issuerCertificate.signatureAlgorithm,
    signature: { unused: 0, data: signature },
  };
}

export function createCertificateChain(...chain: ASN1.CertificateDecoded[]) {
  const certificates = chain.map((cert, i) => {
    const id = `CERT#${i + 1}`;
    return {
      subject: {
        O: id,
        CN: id,
      },
      serialNumber: id,
      pubkey: ASN1.SubjectPublicKeyInfo.encode(cert.tbsCertificate.subjectPublicKeyInfo, 'der'),
      raw: Buffer.from(ASN1.Certificate.encode(cert, 'der')),
    };
  }) as DetailedPeerCertificate[];

  for (let i = 0; i < certificates.length; i++) {
    const cert = certificates[i];
    const issuer = certificates[i + 1] || cert;
    cert.issuerCertificate = issuer;
  }
  return certificates[0];
}
