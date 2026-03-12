import asn1 from 'asn1.js';
import rfc5280, { type AlgorithmIdentifier } from 'asn1.js-rfc5280';
import { ALGORITHM_OID } from './oids';

export const HASH_OID_TO_NAME: Record<string, string> = {
  [ALGORITHM_OID.SHA256]: 'sha256',
  [ALGORITHM_OID.SHA384]: 'sha384',
  [ALGORITHM_OID.SHA512]: 'sha512',
};

const HASH_DIGEST_LENGTH: Record<string, number> = {
  sha256: 32,
  sha384: 48,
  sha512: 64,
};

interface DecodedRSASSAPSSParams {
  hashAlgorithm?: AlgorithmIdentifier;
  saltLength?: InstanceType<typeof asn1.bignum>;
}

export const RSASSAPSSParamsEntity = asn1.define<DecodedRSASSAPSSParams>(
  'RSASSAPSSParams',
  function () {
    this.seq().obj(
      this.key('hashAlgorithm').explicit(0).optional().use(rfc5280.AlgorithmIdentifier),
      // Intentionally ignoring maskGenAlgorithm;
      // Node crypto.verify only works when MGF1 hash matches the signature hash algorithm
      this.key('saltLength').explicit(2).optional().int(),
    );
  },
);

export function parseRSASSAPSSParams(parametersBuffer?: Buffer): {
  hashAlgorithm: string;
  saltLength: number;
} {
  if (!parametersBuffer) {
    throw new Error('RSASSA-PSS signature algorithm is missing parameters buffer');
  }

  const params = RSASSAPSSParamsEntity.decode(parametersBuffer, 'der');

  const hashOid = params.hashAlgorithm ? params.hashAlgorithm.algorithm.join('.') : null;
  const hashAlgorithm = hashOid ? HASH_OID_TO_NAME[hashOid] : null;
  if (!hashAlgorithm) {
    throw new Error(
      `RSASSA-PSS unsupported hashAlgorithm OID: ${hashOid} (only SHA-256, SHA-384, and SHA-512 are supported)`,
    );
  }

  return {
    hashAlgorithm,
    saltLength:
      params.saltLength != null ? params.saltLength.toNumber() : HASH_DIGEST_LENGTH[hashAlgorithm],
  };
}
