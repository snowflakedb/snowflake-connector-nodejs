import crypto from 'crypto';
import rfc5280 from 'asn1.js-rfc5280';
import { ALGORITHM_OID } from './oids';
import { parseRSASSAPSSParams } from './rsassa_pss';

type SignatureVerifier = (crl: rfc5280.CertificateListDecoded, issuerPublicKey: string) => boolean;

function pkcs1Verifier(digestAlg: string): SignatureVerifier {
  return (crl, issuerPublicKey) => {
    const tbsEncoded = rfc5280.TBSCertList.encode(crl.tbsCertList, 'der');
    const verify = crypto.createVerify(digestAlg);
    verify.update(tbsEncoded);
    return verify.verify(issuerPublicKey, crl.signature.data);
  };
}

function pssVerifier(crl: rfc5280.CertificateListDecoded, issuerPublicKey: string) {
  const pssParams = parseRSASSAPSSParams(crl.signatureAlgorithm.parameters);
  const tbsEncoded = rfc5280.TBSCertList.encode(crl.tbsCertList, 'der');
  return crypto.verify(
    pssParams.hashAlgorithm,
    tbsEncoded,
    {
      key: issuerPublicKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: pssParams.saltLength,
    },
    crl.signature.data,
  );
}

export const CRL_SIGNATURE_VERIFIERS: Record<string, SignatureVerifier> = {
  [ALGORITHM_OID.SHA256_WITH_RSA]: pkcs1Verifier('sha256'),
  [ALGORITHM_OID.SHA384_WITH_RSA]: pkcs1Verifier('sha384'),
  [ALGORITHM_OID.SHA512_WITH_RSA]: pkcs1Verifier('sha512'),
  [ALGORITHM_OID.ECDSA_WITH_SHA256]: pkcs1Verifier('sha256'),
  [ALGORITHM_OID.ECDSA_WITH_SHA384]: pkcs1Verifier('sha384'),
  [ALGORITHM_OID.ECDSA_WITH_SHA512]: pkcs1Verifier('sha512'),
  [ALGORITHM_OID.RSASSA_PSS]: pssVerifier,
};

export function isCrlSignatureValid(crl: rfc5280.CertificateListDecoded, issuerPublicKey: string) {
  const signatureAlgOid = crl.signatureAlgorithm.algorithm.join('.');
  const verifier = CRL_SIGNATURE_VERIFIERS[signatureAlgOid];
  if (!verifier) {
    throw new Error(`Unsupported signature algorithm: ${signatureAlgOid}`);
  }
  return verifier(crl, issuerPublicKey);
}
