import crypto from 'crypto';
import rfc5280, { type AlgorithmIdentifier } from 'asn1.js-rfc5280';
import { ALGORITHM_OID } from './oids';
import { parseRSASSAPSSParams } from './rsassa_pss_parser';

type ParsedCertificateList = {
  tbsCertList: Buffer;
  signatureAlgorithm: Buffer;
  signature: Buffer;
};

type SignatureVerifier = (
  parsed: ParsedCertificateList,
  signatureAlgorithm: AlgorithmIdentifier,
  issuerPublicKey: string,
) => boolean;

// A DER CertificateList is a SEQUENCE of three TLVs (Tag-Length-Value):
//
//   30 <len>                         SEQUENCE (CertificateList)
//     30 <len> ...                   TBSCertList         <- exact bytes the signature covers
//     30 <len> <oid> [params]        AlgorithmIdentifier
//     03 <len> 00 <sig...>           BIT STRING (signatureValue)
//
// Each TLV starts with a 1-byte tag, then a length: if the length byte is
// < 0x80 it is the length itself (short form); otherwise its low 7 bits give
// the number of following big-endian bytes that hold the length (long form).
// We walk the three children by reading each header and skipping its content,
// returning views (no copies). The BIT STRING value is prefixed with one
// "unused bits" byte (always 0x00 here) which we drop to get the signature.
function readTlv(buf: Buffer, offset: number) {
  let length = buf[offset + 1];
  let headerLength = 2;
  if (length & 0x80) {
    const numLengthBytes = length & 0x7f;
    length = 0;
    for (let i = 0; i < numLengthBytes; i++) {
      length = length * 256 + buf[offset + 2 + i];
    }
    headerLength = 2 + numLengthBytes;
  }
  const contentStart = offset + headerLength;
  return { contentStart, end: contentStart + length };
}

export function parseCertificateListForVerification(rawCrl: Buffer): ParsedCertificateList {
  if (rawCrl[0] !== 0x30) {
    throw new Error('Invalid CRL: expected a DER SEQUENCE');
  }
  const outer = readTlv(rawCrl, 0);
  const tbs = readTlv(rawCrl, outer.contentStart);
  const sigAlg = readTlv(rawCrl, tbs.end);
  const sigValue = readTlv(rawCrl, sigAlg.end);
  return {
    tbsCertList: rawCrl.subarray(outer.contentStart, tbs.end),
    signatureAlgorithm: rawCrl.subarray(tbs.end, sigAlg.end),
    signature: rawCrl.subarray(sigValue.contentStart + 1, sigValue.end),
  };
}

function digestVerifier(digestAlg: string): SignatureVerifier {
  return (parsed, _signatureAlgorithm, issuerPublicKey) =>
    crypto.verify(digestAlg, parsed.tbsCertList, issuerPublicKey, parsed.signature);
}

const pssVerifier: SignatureVerifier = (parsed, signatureAlgorithm, issuerPublicKey) => {
  const pssParams = parseRSASSAPSSParams(signatureAlgorithm.parameters);
  return crypto.verify(
    pssParams.hashAlgorithm,
    parsed.tbsCertList,
    {
      key: issuerPublicKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: pssParams.saltLength,
    },
    parsed.signature,
  );
};

export const CRL_SIGNATURE_VERIFIERS: Record<string, SignatureVerifier> = {
  [ALGORITHM_OID.SHA256_WITH_RSA]: digestVerifier('sha256'),
  [ALGORITHM_OID.SHA384_WITH_RSA]: digestVerifier('sha384'),
  [ALGORITHM_OID.SHA512_WITH_RSA]: digestVerifier('sha512'),
  [ALGORITHM_OID.ECDSA_WITH_SHA256]: digestVerifier('sha256'),
  [ALGORITHM_OID.ECDSA_WITH_SHA384]: digestVerifier('sha384'),
  [ALGORITHM_OID.ECDSA_WITH_SHA512]: digestVerifier('sha512'),
  [ALGORITHM_OID.RSASSA_PSS]: pssVerifier,
};

export function isCrlSignatureValid(rawCrl: Buffer, issuerPublicKey: string) {
  const parsed = parseCertificateListForVerification(rawCrl);
  const signatureAlgorithm = rfc5280.AlgorithmIdentifier.decode(parsed.signatureAlgorithm, 'der');
  const oid = signatureAlgorithm.algorithm.join('.');
  const verifier = CRL_SIGNATURE_VERIFIERS[oid];
  if (!verifier) {
    throw new Error(`Unsupported signature algorithm: ${oid}`);
  }
  return verifier(parsed, signatureAlgorithm, issuerPublicKey);
}
