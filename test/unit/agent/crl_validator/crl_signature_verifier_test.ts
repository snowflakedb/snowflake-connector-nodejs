import assert from 'assert';
import rfc5280 from 'asn1.js-rfc5280';
import { createCertificateKeyPair, createTestCRL } from './test_utils';
import {
  isCrlSignatureValid,
  parseCertificateListForVerification,
  CRL_SIGNATURE_VERIFIERS,
} from '../../../../lib/agent/crl_validator/crl_signature_verifier';
import { ALGORITHM_OID } from '../../../../lib/agent/crl_validator/oids';
import { HASH_OID_TO_NAME } from '../../../../lib/agent/crl_validator/rsassa_pss_parser';

function encodeCrl(crl: rfc5280.CertificateListDecoded) {
  return rfc5280.CertificateList.encode(crl, 'der');
}

describe('isCrlSignatureValid', () => {
  Object.keys(CRL_SIGNATURE_VERIFIERS)
    .filter((oid) => oid !== ALGORITHM_OID.RSASSA_PSS)
    .forEach((oid) => {
      it(`passes validation for algorithm oid=${oid}`, () => {
        const issuerKeyPair = createCertificateKeyPair(oid);
        const crl = createTestCRL({ issuerKeyPair, signatureAlgorithmOid: oid });
        const isValid = isCrlSignatureValid(encodeCrl(crl), issuerKeyPair.publicKeyPem);
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
      const isValid = isCrlSignatureValid(encodeCrl(crl), issuerKeyPair.publicKeyPem);
      assert.strictEqual(isValid, true);
    });
  });

  it('throws error for certificate with unknown signature algorithm oid', () => {
    const crl = createTestCRL();
    crl.signatureAlgorithm.algorithm = [1, 2, 3, 4, 5];
    assert.throws(
      () => isCrlSignatureValid(encodeCrl(crl), 'public key'),
      /Unsupported signature algorithm: 1\.2\.3\.4\.5/,
    );
  });

  it('returns false for crl with invalid signature', () => {
    const unrelatedKeyPair = createCertificateKeyPair();
    const crl = createTestCRL();
    const isValid = isCrlSignatureValid(encodeCrl(crl), unrelatedKeyPair.publicKeyPem);
    assert.strictEqual(isValid, false);
  });

  it('returns false when the signed TBSCertList bytes are tampered with', () => {
    const issuerKeyPair = createCertificateKeyPair();
    const crl = createTestCRL({ issuerKeyPair });
    const raw = encodeCrl(crl);
    const { tbsCertList } = parseCertificateListForVerification(raw);
    tbsCertList[tbsCertList.length - 1] ^= 0xff;
    const isValid = isCrlSignatureValid(raw, issuerKeyPair.publicKeyPem);
    assert.strictEqual(isValid, false);
  });

  it('throws when the raw CRL is not a DER SEQUENCE', () => {
    assert.throws(
      () => isCrlSignatureValid(Buffer.from([0x02, 0x01, 0x00]), 'public key'),
      /Invalid CRL: expected a DER SEQUENCE/,
    );
  });
});

describe('parseCertificateListForVerification', () => {
  it('extracts the exact DER bytes of the TBSCertList', () => {
    const crl = createTestCRL();
    const raw = encodeCrl(crl);
    const { tbsCertList } = parseCertificateListForVerification(raw);
    assert.deepStrictEqual(tbsCertList, rfc5280.TBSCertList.encode(crl.tbsCertList, 'der'));
  });

  it('extracts the signature matching the decoded CRL signature', () => {
    const crl = createTestCRL();
    const raw = encodeCrl(crl);
    const { signature } = parseCertificateListForVerification(raw);
    assert.deepStrictEqual(signature, crl.signature.data);
  });
});
