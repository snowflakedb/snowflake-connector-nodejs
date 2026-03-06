import asn1 from 'asn1.js';
import { ALGORITHM_OID } from './oids';

const HASH_OID_TO_NAME: Record<string, string> = {
  [ALGORITHM_OID.SHA256]: 'sha256',
  [ALGORITHM_OID.SHA384]: 'sha384',
  [ALGORITHM_OID.SHA512]: 'sha512',
};

const HASH_DIGEST_LENGTH: Record<string, number> = {
  sha256: 32,
  sha384: 48,
  sha512: 64,
};

interface DecodedAlgorithmIdentifier {
  algorithm: number[];
  parameters?: Buffer;
}

interface DecodedRSASSAPSSParams {
  hashAlgorithm?: DecodedAlgorithmIdentifier;
  maskGenAlgorithm?: DecodedAlgorithmIdentifier;
  saltLength?: InstanceType<typeof asn1.bignum>;
  trailerField?: InstanceType<typeof asn1.bignum>;
}

export const AlgorithmIdentifierEntity = asn1.define<DecodedAlgorithmIdentifier>(
  'AlgorithmIdentifier',
  function () {
    this.seq().obj(this.key('algorithm').objid(), this.key('parameters').optional().any());
  },
);

export const RSASSAPSSParamsEntity = asn1.define<DecodedRSASSAPSSParams>(
  'RSASSAPSSParams',
  function () {
    this.seq().obj(
      this.key('hashAlgorithm').explicit(0).optional().use(AlgorithmIdentifierEntity),
      this.key('maskGenAlgorithm').explicit(1).optional().use(AlgorithmIdentifierEntity),
      this.key('saltLength').explicit(2).optional().int(),
      this.key('trailerField').explicit(3).optional().int(),
    );
  },
);

export function parseRSASSAPSSParams(parametersBuffer: Buffer | undefined): {
  hashAlgorithm: string;
  saltLength: number;
} {
  if (!parametersBuffer) {
    throw new Error('RSASSA-PSS signature algorithm is missing required parameters');
  }

  const params = RSASSAPSSParamsEntity.decode(parametersBuffer, 'der');

  // RFC 4055: when hashAlgorithm is absent, it should default to SHA-1
  const hashOid = params.hashAlgorithm
    ? params.hashAlgorithm.algorithm.join('.')
    : ALGORITHM_OID.SHA1;
  const hashAlgorithm = HASH_OID_TO_NAME[hashOid];
  if (!hashAlgorithm) {
    throw new Error(
      `RSASSA-PSS unsupported hashAlgorithm OID: ${hashOid} (only SHA-256, SHA-384, and SHA-512 are supported)`,
    );
  }

  if (params.maskGenAlgorithm) {
    const mgfOid = params.maskGenAlgorithm.algorithm.join('.');
    if (mgfOid !== ALGORITHM_OID.MGF1) {
      throw new Error(
        `RSASSA-PSS unsupported maskGenAlgorithm OID: ${mgfOid} (only MGF1 is supported)`,
      );
    }
    if (params.maskGenAlgorithm.parameters) {
      const mgfHashParams = AlgorithmIdentifierEntity.decode(
        params.maskGenAlgorithm.parameters,
        'der',
      );
      const mgfHashOid = mgfHashParams.algorithm.join('.');
      if (mgfHashOid !== hashOid) {
        throw new Error(
          `RSASSA-PSS MGF1 hash OID (${mgfHashOid}) does not match hashAlgorithm OID (${hashOid})`,
        );
      }
    }
  }

  const maxSaltLength = HASH_DIGEST_LENGTH[hashAlgorithm];
  const saltLength = params.saltLength != null ? params.saltLength.toNumber() : maxSaltLength;
  if (saltLength < 0 || saltLength > maxSaltLength) {
    throw new Error(
      `RSASSA-PSS saltLength ${saltLength} is out of valid range [0, ${maxSaltLength}] for ${hashAlgorithm}`,
    );
  }

  return { hashAlgorithm, saltLength };
}
