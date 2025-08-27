import { DetailedPeerCertificate } from 'tls';
import { CRLDistributionPoint } from '../../../lib/agent/crl_utils';
const ASN1 = require('asn1.js-rfc5280');

export function createTestCertificate({
  crlDistributionPoints,
  validFrom,
  validTo,
}: {
  crlDistributionPoints?: CRLDistributionPoint[];
  validFrom?: string;
  validTo?: string;
} = {}): DetailedPeerCertificate {
  // NOTE: Generated using AI based on ASN1.js cert validation
  const cert = {
    tbsCertificate: {
      version: 2,
      serialNumber: Buffer.from('01', 'hex'),
      signature: {
        algorithm: [1, 2, 840, 113549, 1, 1, 11],
        parameters: Buffer.from([0x05, 0x00]),
      },
      issuer: {
        type: 'rdnSequence',
        value: [],
      },
      validity: {
        notBefore: {
          type: 'utcTime',
          value: new Date('2023-01-01'),
        },
        notAfter: {
          type: 'utcTime',
          value: new Date('2024-01-01'),
        },
      },
      subject: {
        type: 'rdnSequence',
        value: [],
      },
      subjectPublicKeyInfo: {
        algorithm: {
          algorithm: [1, 2, 840, 113549, 1, 1, 1],
          parameters: Buffer.from([0x05, 0x00]),
        },
        subjectPublicKey: {
          unused: 0,
          data: Buffer.from('00', 'hex'),
        },
      },
      extensions: crlDistributionPoints
        ? [
            {
              extnID: 'cRLDistributionPoints',
              critical: false,
              extnValue: crlDistributionPoints,
            },
          ]
        : [],
    },
    signatureAlgorithm: {
      algorithm: [1, 2, 840, 113549, 1, 1, 11],
      parameters: Buffer.from([0x05, 0x00]),
    },
    signature: {
      unused: 0,
      data: Buffer.from('00', 'hex'),
    },
  };

  const encoded = ASN1.Certificate.encode(cert, 'der');
  const certObj = {
    raw: encoded,
    valid_from: validFrom ?? new Date().toUTCString(),
    valid_to: validTo ?? new Date().toUTCString(),
    serialNumber: '01',
    subject: {},
    issuer: {},
    subjectaltname: '',
    infoAccess: {},
    pubkey: Buffer.from(''),
    fingerprint: '',
    fingerprint256: '',
    fingerprint512: '',
    ext_key_usage: [],
    ca: false,
  } as unknown as DetailedPeerCertificate;
  certObj.issuerCertificate = certObj;

  return certObj;
}
