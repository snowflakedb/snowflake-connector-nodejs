import assert from 'assert';
import {
  getCertificateCrlUrls,
  isCertificateRevoked,
  isCrlDistributionPointExtensionValid,
  isCrlSignatureValid,
  isShortLivedCertificate,
  SUPPORTED_CRL_VERIFICATION_ALGORITHMS,
} from '../../../lib/agent/crl_utils';
import { createCertificateKeyPair, createTestCertificate, createTestCRL } from './test_utils';

describe('isShortLivedCertificate', () => {
  const testCases: {
    name: string;
    notBefore: string;
    notAfter: string;
    expectedResult: boolean;
  }[] = [
    // Certificates issued between March 15, 2024 and March 15, 2026 (10 days + 1 minute limit)
    {
      name: 'returns true for 7-day certificate in 2024-2026 period',
      notBefore: 'Mar 15 2024 00:00:00 GMT',
      notAfter: 'Mar 22 2024 00:00:00 GMT',
      expectedResult: true,
    },
    {
      name: 'returns false for 11-day certificate in 2024-2026 period',
      notBefore: 'Mar 15 2024 00:00:00 GMT',
      notAfter: 'Mar 26 2024 00:00:00 GMT',
      expectedResult: false,
    },
    {
      name: 'returns true for 10 days + 1 minute certificate in 2024-2026 period',
      notBefore: 'Mar 15 2024 00:00:00 GMT',
      notAfter: 'Mar 25 2024 00:00:59 GMT',
      expectedResult: true,
    },
    // Certificates issued on or after March 15, 2026 (7 days + 1 minute limit)
    {
      name: 'returns true for 5-day certificate in 2026+ period',
      notBefore: 'Mar 15 2026 00:00:00 GMT',
      notAfter: 'Mar 20 2026 00:00:00 GMT',
      expectedResult: true,
    },
    {
      name: 'returns false for 8-day certificate in 2026+ period',
      notBefore: 'Mar 15 2026 00:00:00 GMT',
      notAfter: 'Mar 23 2026 00:00:00 GMT',
      expectedResult: false,
    },
    {
      name: 'returns true for 7 days + 1 minute certificate in 2026+ period',
      notBefore: 'Mar 15 2026 00:00:00 GMT',
      notAfter: 'Mar 22 2026 00:00:59 GMT',
      expectedResult: true,
    },
  ];

  for (const testCase of testCases) {
    it(testCase.name, () => {
      const certificate = createTestCertificate({
        notBefore: testCase.notBefore,
        notAfter: testCase.notAfter,
      });
      assert.strictEqual(isShortLivedCertificate(certificate), testCase.expectedResult);
    });
  }
});

describe('getCertificateCrlUrls', () => {
  const testCases: {
    name: string;
    expectedResult: string[] | null;
    certificateParams: Parameters<typeof createTestCertificate>[0];
  }[] = [
    {
      name: 'returns null for certificate without cRLDistributionPoints',
      certificateParams: undefined,
      expectedResult: null,
    },
    {
      name: 'returns HTTP URL from valid CRL distribution point',
      certificateParams: {
        crlUrls: ['http://crl.example.com/cert.crl'],
      },
      expectedResult: ['http://crl.example.com/cert.crl'],
    },
    {
      name: 'skips non-HTTP URLs',
      certificateParams: {
        crlUrls: ['ldap://ldap.example.com/cert.crl'],
      },
      expectedResult: null,
    },
    {
      name: 'picks first HTTP URL when multiple are present',
      certificateParams: {
        crlUrls: ['http://crl1.example.com/cert.crl', 'http://crl2.example.com/cert.crl'],
      },
      expectedResult: ['http://crl1.example.com/cert.crl'],
    },
    {
      name: 'skips non-uniformResourceIdentifier entries',
      certificateParams: {
        extensions: [
          {
            extnID: 'cRLDistributionPoints',
            extnValue: [
              {
                distributionPoint: {
                  type: 'fullName',
                  value: [{ type: 'dNSName', value: 'crl.example.com' }],
                },
              },
              {
                distributionPoint: {
                  type: 'fullName',
                  value: [
                    {
                      type: 'uniformResourceIdentifier',
                      value: 'http://crl.example.com/cert.crl',
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
      expectedResult: ['http://crl.example.com/cert.crl'],
    },
    {
      name: 'skips entries without distributionPoint',
      certificateParams: {
        extensions: [
          {
            extnID: 'cRLDistributionPoints',
            extnValue: [
              {},
              {
                distributionPoint: {
                  type: 'fullName',
                  value: [
                    {
                      type: 'uniformResourceIdentifier',
                      value: 'http://crl.example.com/cert.crl',
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
      expectedResult: ['http://crl.example.com/cert.crl'],
    },
    {
      name: 'handles multiple distribution points and picks first HTTP URL in each',
      certificateParams: {
        extensions: [
          {
            extnID: 'cRLDistributionPoints',
            extnValue: [
              {
                distributionPoint: {
                  type: 'fullName',
                  value: [
                    {
                      type: 'uniformResourceIdentifier',
                      value: 'http://point1.com/cert1.crl',
                    },
                    {
                      type: 'uniformResourceIdentifier',
                      value: 'http://point1.com/cert2.crl',
                    },
                  ],
                },
              },
              {
                distributionPoint: {
                  type: 'fullName',
                  value: [
                    {
                      type: 'uniformResourceIdentifier',
                      value: 'http://point2.com/cert1.crl',
                    },
                    {
                      type: 'uniformResourceIdentifier',
                      value: 'http://point2.com/cert2.crl',
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
      expectedResult: ['http://point1.com/cert1.crl', 'http://point2.com/cert1.crl'],
    },
  ];

  for (const testCase of testCases) {
    it(testCase.name, () => {
      const certificate = createTestCertificate(testCase.certificateParams);
      const urls = getCertificateCrlUrls('name', certificate);
      assert.deepStrictEqual(urls, testCase.expectedResult);
    });
  }
});

describe('isCrlSignatureValid', () => {
  Object.keys(SUPPORTED_CRL_VERIFICATION_ALGORITHMS).forEach((oid) => {
    it(`passes validation for algorithm oid=${oid}`, () => {
      const issuerKeyPair = createCertificateKeyPair(oid);
      const crl = createTestCRL({ issuerKeyPair });
      const isValid = isCrlSignatureValid(crl, issuerKeyPair.publicKeyPem);
      assert.strictEqual(isValid, true);
    });
  });

  it('throws error for certificate with unknown signature algorithm oid', () => {
    const crl = createTestCRL();
    crl.signatureAlgorithm.algorithm = [1, 2, 3, 4, 5];
    assert.throws(
      () => isCrlSignatureValid(crl, 'public key'),
      /Unsupported signature algorithm: 1\.2\.3\.4\.5/,
    );
  });

  it('throws error for crl with invalid signature', () => {
    const unrelatedKeyPair = createCertificateKeyPair();
    const crl = createTestCRL();
    const isValid = isCrlSignatureValid(crl, unrelatedKeyPair.publicKeyPem);
    assert.strictEqual(isValid, false);
  });
});

describe('isCertificateRevoked', () => {
  it('returns true for revoked certificate', () => {
    const certificate = createTestCertificate({
      serialNumber: 1000,
    });
    const crl = createTestCRL({ revokedCertificates: [1000] });
    const isRevoked = isCertificateRevoked(certificate, crl);
    assert.strictEqual(isRevoked, true);
  });

  it('returns false in certificate is not in CRL', () => {
    const certificate = createTestCertificate();
    const crl = createTestCRL();
    const isRevoked = isCertificateRevoked(certificate, crl);
    assert.strictEqual(isRevoked, false);
  });
});

describe('isCrlDistributionPointExtensionValid', () => {
  it('returns true for crl without issuingDistributionPoint extension', () => {
    const crl = createTestCRL();
    const isValid = isCrlDistributionPointExtensionValid(crl, 'http://crl.example.com/cert.crl');
    assert.strictEqual(isValid, true);
  });

  it('returns true when crl has issuingDistributionPoint extension with matching url', () => {
    const crl = createTestCRL({
      issuingDistributionPointUrls: ['http://crl.example.com/cert.crl'],
    });
    const isValid = isCrlDistributionPointExtensionValid(crl, 'http://crl.example.com/cert.crl');
    assert.strictEqual(isValid, true);
  });

  it('returns false when crl has issuingDistributionPoint extension with non-matching url', () => {
    const crl = createTestCRL({
      issuingDistributionPointUrls: ['http://crl.example.com/cert.crl'],
    });
    const isValid = isCrlDistributionPointExtensionValid(crl, 'http://crl.example.com/cert2.crl');
    assert.strictEqual(isValid, false);
  });
});
