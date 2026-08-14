import crypto from 'crypto';
import rfc5280 from 'asn1.js-rfc5280';
import { ALGORITHM_OID } from './oids';
import { parseRSASSAPSSParams } from './rsassa_pss_parser';

// Signatures are computed over the original DER bytes of tbsCertList as they
// appear on the wire, not over a canonical re-encoding. Re-encoding via
// rfc5280.TBSCertList.encode() is both expensive (a full serialization pass
// over the entire, potentially multi-MB, revoked list) and subtly incorrect
// when the CA used non-canonical DER.
//
// A CRL is CertificateList ::= SEQUENCE { tbsCertList TBSCertList, ... }, so the
// tbsCertList is the first element inside the outer SEQUENCE. We parse only the
// two DER tag/length headers (outer SEQUENCE, then tbsCertList SEQUENCE) to locate
// the exact byte range of tbsCertList and return a zero-copy slice of the original
// buffer. The revoked list is never parsed, so this is cheap regardless of CRL size.
//
// NOTE:
// asn1.js `.any()` cannot be used here: for a field inside a SEQUENCE it slices
// from the field start to the end of the *entire* buffer, over-capturing the
// trailing signatureAlgorithm and signature. We must compute the element's own
// length instead.

// Reads a DER tag/length header at the given offset and returns the offset of
// the content and the content length.
function readDerHeader(buffer: Buffer, offset: number): { contentStart: number; length: number } {
  // Skip the (single-byte, universal) tag. CRL tags of interest (SEQUENCE) are
  // single-byte, so we do not handle multi-byte tags here.
  let cursor = offset + 1;

  const firstLenByte = buffer[cursor++];
  if ((firstLenByte & 0x80) === 0) {
    // Short form: length fits in the low 7 bits.
    return { contentStart: cursor, length: firstLenByte };
  }

  // Long form: low 7 bits give the number of subsequent length octets.
  const numLenBytes = firstLenByte & 0x7f;
  if (numLenBytes === 0) {
    throw new Error('Indefinite-length DER encoding is not supported for CRL tbsCertList');
  }
  let length = 0;
  for (let i = 0; i < numLenBytes; i++) {
    length = length * 0x100 + buffer[cursor++];
  }
  return { contentStart: cursor, length };
}

// Returns a zero-copy Buffer slice of the raw DER-encoded tbsCertList element
// (including its own tag and length header) from a full DER-encoded CRL.
export function getRawTbsCertList(rawCrl: Buffer): Buffer {
  // Outer element: CertificateList SEQUENCE. Its content starts at the tbsCertList.
  const outer = readDerHeader(rawCrl, 0);
  const tbsStart = outer.contentStart;

  // First inner element: tbsCertList SEQUENCE.
  const tbs = readDerHeader(rawCrl, tbsStart);
  const tbsEnd = tbs.contentStart + tbs.length;

  return rawCrl.subarray(tbsStart, tbsEnd);
}

type SignatureVerifier = (
  crl: rfc5280.CertificateListDecoded,
  rawTbsCertList: Buffer,
  issuerPublicKey: string,
) => boolean;

function digestVerifier(digestAlg: string): SignatureVerifier {
  return (crl, rawTbsCertList, issuerPublicKey) => {
    return crypto.verify(digestAlg, rawTbsCertList, issuerPublicKey, crl.signature.data);
  };
}

function pssVerifier(
  crl: rfc5280.CertificateListDecoded,
  rawTbsCertList: Buffer,
  issuerPublicKey: string,
) {
  const pssParams = parseRSASSAPSSParams(crl.signatureAlgorithm.parameters);
  return crypto.verify(
    pssParams.hashAlgorithm,
    rawTbsCertList,
    {
      key: issuerPublicKey,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
      saltLength: pssParams.saltLength,
    },
    crl.signature.data,
  );
}

export const CRL_SIGNATURE_VERIFIERS: Record<string, SignatureVerifier> = {
  [ALGORITHM_OID.SHA256_WITH_RSA]: digestVerifier('sha256'),
  [ALGORITHM_OID.SHA384_WITH_RSA]: digestVerifier('sha384'),
  [ALGORITHM_OID.SHA512_WITH_RSA]: digestVerifier('sha512'),
  [ALGORITHM_OID.ECDSA_WITH_SHA256]: digestVerifier('sha256'),
  [ALGORITHM_OID.ECDSA_WITH_SHA384]: digestVerifier('sha384'),
  [ALGORITHM_OID.ECDSA_WITH_SHA512]: digestVerifier('sha512'),
  [ALGORITHM_OID.RSASSA_PSS]: pssVerifier,
};

export function isCrlSignatureValid(
  crl: rfc5280.CertificateListDecoded,
  rawTbsCertList: Buffer,
  issuerPublicKey: string,
) {
  const signatureAlgOid = crl.signatureAlgorithm.algorithm.join('.');
  const verifier = CRL_SIGNATURE_VERIFIERS[signatureAlgOid];
  if (!verifier) {
    throw new Error(`Unsupported signature algorithm: ${signatureAlgOid}`);
  }
  return verifier(crl, rawTbsCertList, issuerPublicKey);
}
