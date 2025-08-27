import assert from 'assert';
import { validateCrl, CRLConfig } from '../../../lib/agent/crl_validator';
import { createTestCertificate, createCertificateChain } from './test_utils';

describe('validateCrl', () => {
  const baseCrlConfig: CRLConfig = {
    checkMode: 'ENABLED',
    allowCertificatesWithoutCrlURL: false,
    inMemoryCache: true,
    onDiskCache: false,
    downloadTimeoutMs: 5000,
  };

  it('passes for short-lived certificate', () => {
    const certificate = createTestCertificate({
      validFrom: 'Mar 15 2024 00:00:00 GMT',
      validTo: 'Mar 22 2024 00:00:00 GMT',
      crlDistributionPoints: null,
    });
    assert.doesNotThrow(() => {
      validateCrl(certificate, baseCrlConfig);
    });
  });

  it('handles certificate without CRL URL', () => {
    const certificate = createTestCertificate({ crlDistributionPoints: null });
    assert.throws(() => {
      validateCrl(certificate, baseCrlConfig);
    }, /Certificate does not have CRL http URL/);
    assert.doesNotThrow(() => {
      validateCrl(certificate, { ...baseCrlConfig, allowCertificatesWithoutCrlURL: true });
    });
  });

  it('fails for chain with invalid certificate', () => {
    const validCertificate = createTestCertificate();
    const invalidCertificate = createTestCertificate({ crlDistributionPoints: null });
    const chain = createCertificateChain(validCertificate, invalidCertificate);
    assert.throws(
      () => {
        validateCrl(chain, baseCrlConfig);
      },
      (err: any) => {
        assert.strictEqual(err.certificate, invalidCertificate);
        assert.ok(err.message.includes('Certificate does not have CRL http URL'));
        return true;
      },
    );
  });
});
