import assert from 'assert';
import { createCertificateKeyPair, createTestCRL } from './test_utils';
import {
  isCrlSignatureValid,
  CRL_SIGNATURE_VERIFIERS,
} from '../../../../lib/agent/crl_validator/crl_signature_verifier';

describe('isCrlSignatureValid', () => {
  Object.keys(CRL_SIGNATURE_VERIFIERS).forEach((oid) => {
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
