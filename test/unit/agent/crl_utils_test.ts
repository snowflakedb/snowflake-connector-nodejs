import assert from 'assert';
import { getCertificateCrlUrls, isShortLivedCertificate } from '../../../lib/agent/crl_utils';
import { createTestCertificate, CreateTestCertificateOptions } from './test_utils';

describe('getCertificateCrlUrls', () => {
  const testCases: {
    name: string;
    expectedResult: string[] | null;
    crlDistributionPoints?: CreateTestCertificateOptions['crlDistributionPoints'];
  }[] = [
    {
      name: 'returns null for certificate without cRLDistributionPoints',
      crlDistributionPoints: null,
      expectedResult: null,
    },
    {
      name: 'returns HTTP URL from valid CRL distribution point',
      crlDistributionPoints: [
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
      expectedResult: ['http://crl.example.com/cert.crl'],
    },
    {
      name: 'skips non-HTTP URLs',
      crlDistributionPoints: [
        {
          distributionPoint: {
            type: 'fullName',
            value: [
              {
                type: 'uniformResourceIdentifier',
                value: 'ldap://ldap.example.com/cert.crl',
              },
            ],
          },
        },
      ],
      expectedResult: null,
    },
    {
      name: 'picks first HTTP URL when multiple are present',
      crlDistributionPoints: [
        {
          distributionPoint: {
            type: 'fullName',
            value: [
              {
                type: 'uniformResourceIdentifier',
                value: 'http://crl1.example.com/cert.crl',
              },
              {
                type: 'uniformResourceIdentifier',
                value: 'http://crl2.example.com/cert.crl',
              },
            ],
          },
        },
      ],
      expectedResult: ['http://crl1.example.com/cert.crl'],
    },
    {
      name: 'skips non-uniformResourceIdentifier entries',
      crlDistributionPoints: [
        {
          distributionPoint: {
            type: 'fullName',
            value: [
              {
                type: 'dNSName',
                value: 'crl.example.com',
              },
              {
                type: 'uniformResourceIdentifier',
                value: 'http://crl.example.com/cert.crl',
              },
            ],
          },
        },
      ],
      expectedResult: ['http://crl.example.com/cert.crl'],
    },
    {
      name: 'skips entries without distributionPoint',
      crlDistributionPoints: [
        {
          nameRelativeToCRLIssuer: [[{ type: '2.5.4.3', value: 'MyCRLIssuer' }]],
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
      expectedResult: ['http://crl.example.com/cert.crl'],
    },
    {
      name: 'handles multiple distribution points and picks first HTTP URL in each',
      crlDistributionPoints: [
        {
          distributionPoint: {
            type: 'fullName',
            value: [
              {
                type: 'uniformResourceIdentifier',
                value: 'ldap://ldap.example.com/cert.crl',
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
                value: 'http://crl1.example.com/cert.crl',
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
                value: 'http://crl2.example.com/cert.crl',
              },
            ],
          },
        },
      ],
      expectedResult: ['http://crl1.example.com/cert.crl', 'http://crl2.example.com/cert.crl'],
    },
  ];

  for (const testCase of testCases) {
    it(testCase.name, () => {
      const cert = createTestCertificate({ crlDistributionPoints: testCase.crlDistributionPoints });
      const urls = getCertificateCrlUrls(cert);
      assert.deepStrictEqual(urls, testCase.expectedResult);
    });
  }
});

describe('isShortLivedCertificate', () => {
  const testCases: {
    name: string;
    validFrom: string;
    validTo: string;
    expectedResult: boolean;
  }[] = [
    {
      name: 'returns false for certificate issued before March 15, 2024',
      validFrom: 'Mar 14 2024 23:59:59 GMT',
      validTo: 'Mar 15 2024 23:59:59 GMT',
      expectedResult: false,
    },
    // Certificates issued between March 15, 2024 and March 15, 2026 (10 days + 1 minute limit)
    {
      name: 'returns true for 7-day certificate in 2024-2026 period',
      validFrom: 'Mar 15 2024 00:00:00 GMT',
      validTo: 'Mar 22 2024 00:00:00 GMT',
      expectedResult: true,
    },
    {
      name: 'returns false for 11-day certificate in 2024-2026 period',
      validFrom: 'Mar 15 2024 00:00:00 GMT',
      validTo: 'Mar 26 2024 00:00:00 GMT',
      expectedResult: false,
    },
    {
      name: 'returns true for 10 days + 1 minute certificate in 2024-2026 period',
      validFrom: 'Mar 15 2024 00:00:00 GMT',
      validTo: 'Mar 25 2024 00:00:59 GMT',
      expectedResult: true,
    },
    // Certificates issued on or after March 15, 2026 (7 days + 1 minute limit)
    {
      name: 'returns true for 5-day certificate in 2026+ period',
      validFrom: 'Mar 15 2026 00:00:00 GMT',
      validTo: 'Mar 20 2026 00:00:00 GMT',
      expectedResult: true,
    },
    {
      name: 'returns false for 8-day certificate in 2026+ period',
      validFrom: 'Mar 15 2026 00:00:00 GMT',
      validTo: 'Mar 23 2026 00:00:00 GMT',
      expectedResult: false,
    },
    {
      name: 'returns true for 7 days + 1 minute certificate in 2026+ period',
      validFrom: 'Mar 15 2026 00:00:00 GMT',
      validTo: 'Mar 22 2026 00:00:59 GMT',
      expectedResult: true,
    },
  ];

  for (const testCase of testCases) {
    it(testCase.name, () => {
      const cert = createTestCertificate({
        validFrom: testCase.validFrom,
        validTo: testCase.validTo,
      });
      assert.strictEqual(isShortLivedCertificate(cert), testCase.expectedResult);
    });
  }
});
