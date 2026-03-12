import assert from 'assert';
import { createCertificateKeyPair, createTestCRL } from './test_utils';
import {
  isCrlSignatureValid,
  CRL_SIGNATURE_VERIFIERS,
} from '../../../../lib/agent/crl_validator/crl_signature_verifier';
import { ALGORITHM_OID } from '../../../../lib/agent/crl_validator/oids';
import { HASH_OID_TO_NAME } from '../../../../lib/agent/crl_validator/rsassa_pss_parser';

describe('isCrlSignatureValid', () => {
  Object.keys(CRL_SIGNATURE_VERIFIERS)
    .filter((oid) => oid !== ALGORITHM_OID.RSASSA_PSS)
    .forEach((oid) => {
      it(`passes validation for algorithm oid=${oid}`, () => {
        const issuerKeyPair = createCertificateKeyPair(oid);
        const crl = createTestCRL({ issuerKeyPair, signatureAlgorithmOid: oid });
        const isValid = isCrlSignatureValid(crl, issuerKeyPair.publicKeyPem);
        assert.strictEqual(isValid, true);
      });
    });

  Object.entries(HASH_OID_TO_NAME).forEach(([oid, name]) => {
    it(`passes validation for RSASSA-PSS with ${name} hash algorithm`, () => {
      const issuerKeyPair = createCertificateKeyPair(ALGORITHM_OID.RSASSA_PSS);
      const crl = createTestCRL({
        issuerKeyPair,
        signatureAlgorithmOid: ALGORITHM_OID.RSASSA_PSS,
        rsassaPssHashOid: oid,
      });
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

  it('returns false for crl with invalid signature', () => {
    const unrelatedKeyPair = createCertificateKeyPair();
    const crl = createTestCRL();
    const isValid = isCrlSignatureValid(crl, unrelatedKeyPair.publicKeyPem);
    assert.strictEqual(isValid, false);
  });
});
