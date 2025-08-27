import assert from 'assert';
import { CRLDistributionPoint, getCertificateCrlUrls } from '../../../lib/agent/crl_utils';
import { createTestCertificate } from './test_utils';

describe('getCertificateCrlUrls', () => {
  const testCases: {
    name: string;
    expectedResult: string[] | null;
    crlDistributionPoints?: CRLDistributionPoint[];
  }[] = [
    {
      name: 'returns null for certificate without cRLDistributionPoints',
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
