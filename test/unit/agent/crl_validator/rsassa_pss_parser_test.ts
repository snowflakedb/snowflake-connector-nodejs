import assert from 'assert';
import { ALGORITHM_OID } from '../../../../lib/agent/crl_validator/oids';
import { parseRSASSAPSSParams } from '../../../../lib/agent/crl_validator/rsassa_pss_parser';
import { createPSSAlgorithmIdentifier } from './test_utils';

describe('parseRSASSAPSSParams', () => {
  it('throws when parametersBuffer is missing', () => {
    assert.throws(
      () => parseRSASSAPSSParams(),
      /RSASSA-PSS signature algorithm is missing parameters buffer/,
    );
  });

  it('returns hashAlgorithm and saltLength for SHA-256', () => {
    const algId = createPSSAlgorithmIdentifier({ hashOid: ALGORITHM_OID.SHA256 });
    const result = parseRSASSAPSSParams(algId.parameters);
    assert.strictEqual(result.hashAlgorithm, 'sha256');
    assert.strictEqual(result.saltLength, 32);
  });

  it('returns hashAlgorithm and saltLength for SHA-384', () => {
    const algId = createPSSAlgorithmIdentifier({ hashOid: ALGORITHM_OID.SHA384 });
    const result = parseRSASSAPSSParams(algId.parameters);
    assert.strictEqual(result.hashAlgorithm, 'sha384');
    assert.strictEqual(result.saltLength, 48);
  });

  it('returns hashAlgorithm and saltLength for SHA-512', () => {
    const algId = createPSSAlgorithmIdentifier({ hashOid: ALGORITHM_OID.SHA512 });
    const result = parseRSASSAPSSParams(algId.parameters);
    assert.strictEqual(result.hashAlgorithm, 'sha512');
    assert.strictEqual(result.saltLength, 64);
  });

  it('throws when hashAlgorithm is absent (defaults to unsupported SHA-1 per RFC 4055)', () => {
    const algId = createPSSAlgorithmIdentifier();
    assert.throws(
      () => parseRSASSAPSSParams(algId.parameters),
      /unsupported hashAlgorithm OID:.*only SHA-256, SHA-384, and SHA-512 are supported/,
    );
  });

  it('throws when hashAlgorithm is explicitly set to unsupported SHA-1', () => {
    const algId = createPSSAlgorithmIdentifier({ hashOid: ALGORITHM_OID.SHA1 });
    assert.throws(
      () => parseRSASSAPSSParams(algId.parameters),
      /unsupported hashAlgorithm OID.*only SHA-256, SHA-384, and SHA-512 are supported/,
    );
  });

  it('accepts saltLength larger than hash digest length', () => {
    const algId = createPSSAlgorithmIdentifier({ hashOid: ALGORITHM_OID.SHA256, saltLength: 33 });
    const result = parseRSASSAPSSParams(algId.parameters);
    assert.strictEqual(result.saltLength, 33);
  });

  it('accepts saltLength of zero', () => {
    const algId = createPSSAlgorithmIdentifier({ hashOid: ALGORITHM_OID.SHA256, saltLength: 0 });
    const result = parseRSASSAPSSParams(algId.parameters);
    assert.strictEqual(result.hashAlgorithm, 'sha256');
    assert.strictEqual(result.saltLength, 0);
  });

  it('throws on malformed parametersBuffer', () => {
    assert.throws(() => parseRSASSAPSSParams(Buffer.from([0xde, 0xad, 0xbe, 0xef])));
  });
});
