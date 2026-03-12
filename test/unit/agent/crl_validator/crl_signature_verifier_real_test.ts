import assert from 'assert';
import fs from 'fs';
import path from 'path';
import rfc5280 from 'asn1.js-rfc5280';
import { isCrlSignatureValid } from '../../../../lib/agent/crl_validator/crl_signature_verifier';
import { ALGORITHM_OID } from '../../../../lib/agent/crl_validator/oids';
import { createCertificateKeyPair } from './test_utils';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

describe('isCrlSignatureValid with real OpenSSL-generated CRL', () => {
  describe('RSASSA-PSS SHA-256', () => {
    let crl: rfc5280.CertificateListDecoded;
    let caPem: string;

    before(() => {
      const crlDer = fs.readFileSync(path.join(FIXTURES_DIR, 'pss_sha256.crl'));
      caPem = fs.readFileSync(path.join(FIXTURES_DIR, 'pss_sha256_ca.pem'), 'utf8');
      crl = rfc5280.CertificateList.decode(crlDer, 'der');
    });

    it('validates the CRL against its CA public key', () => {
      const signatureOid = crl.signatureAlgorithm.algorithm.join('.');
      assert.strictEqual(signatureOid, ALGORITHM_OID.RSASSA_PSS);
      const isValid = isCrlSignatureValid(crl, caPem);
      assert.strictEqual(isValid, true);
    });

    it('rejects the CRL when verified against an unrelated key', () => {
      const unrelatedKeyPair = createCertificateKeyPair();
      const isValid = isCrlSignatureValid(crl, unrelatedKeyPair.publicKeyPem);
      assert.strictEqual(isValid, false);
    });
  });
});
