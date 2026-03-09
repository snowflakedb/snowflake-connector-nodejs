import crypto from 'crypto';
import rfc5280 from 'asn1.js-rfc5280';
import { ALGORITHM_OID } from './oids';

type SignatureVerifier = (crl: rfc5280.CertificateListDecoded, issuerPublicKey: string) => boolean;

function digestVerifier(digestAlg: string): SignatureVerifier {
  return (crl, issuerPublicKey) => {
    const tbsEncoded = rfc5280.TBSCertList.encode(crl.tbsCertList, 'der');
    const verify = crypto.createVerify(digestAlg);
    verify.update(tbsEncoded);
    return verify.verify(issuerPublicKey, crl.signature.data);
  };
}

// TODO:
// Implement RSASSA-PSS signature verification
// https://snowflakecomputing.atlassian.net/browse/SNOW-2333028
export const CRL_SIGNATURE_VERIFIERS: Record<string, SignatureVerifier> = {
  [ALGORITHM_OID.SHA256_WITH_RSA]: digestVerifier('sha256'),
  [ALGORITHM_OID.SHA384_WITH_RSA]: digestVerifier('sha384'),
  [ALGORITHM_OID.SHA512_WITH_RSA]: digestVerifier('sha512'),
  [ALGORITHM_OID.ECDSA_WITH_SHA256]: digestVerifier('sha256'),
  [ALGORITHM_OID.ECDSA_WITH_SHA384]: digestVerifier('sha384'),
  [ALGORITHM_OID.ECDSA_WITH_SHA512]: digestVerifier('sha512'),
};

export function isCrlSignatureValid(crl: rfc5280.CertificateListDecoded, issuerPublicKey: string) {
  const signatureAlgOid = crl.signatureAlgorithm.algorithm.join('.');
  const verifier = CRL_SIGNATURE_VERIFIERS[signatureAlgOid];
  if (!verifier) {
    throw new Error(`Unsupported signature algorithm: ${signatureAlgOid}`);
  }
  return verifier(crl, issuerPublicKey);
}
