import assert from 'assert';
import { parseRSASSAPSSParams } from '../../../lib/agent/rsassa_pss';
import { buildPSSAlgorithmIdentifier } from './test_utils';

describe('parseRSASSAPSSParams', () => {
  it('returns hashAlgorithm and saltLength for SHA-256', () => {
    const algId = buildPSSAlgorithmIdentifier('2.16.840.1.101.3.4.2.1', 32);
    const result = parseRSASSAPSSParams(algId.parameters);
    assert.strictEqual(result.hashAlgorithm, 'sha256');
    assert.strictEqual(result.saltLength, 32);
  });

  it('returns hashAlgorithm and saltLength for SHA-384', () => {
    const algId = buildPSSAlgorithmIdentifier('2.16.840.1.101.3.4.2.2', 48);
    const result = parseRSASSAPSSParams(algId.parameters);
    assert.strictEqual(result.hashAlgorithm, 'sha384');
    assert.strictEqual(result.saltLength, 48);
  });

  it('returns hashAlgorithm and saltLength for SHA-512', () => {
    const algId = buildPSSAlgorithmIdentifier('2.16.840.1.101.3.4.2.3', 64);
    const result = parseRSASSAPSSParams(algId.parameters);
    assert.strictEqual(result.hashAlgorithm, 'sha512');
    assert.strictEqual(result.saltLength, 64);
  });

  it('throws when hashAlgorithm is absent (defaults to unsupported SHA-1 per RFC 4055)', () => {
    const algId = buildPSSAlgorithmIdentifier(null);
    assert.throws(
      () => parseRSASSAPSSParams(algId.parameters),
      /unsupported hashAlgorithm OID: 1\.3\.14\.3\.2\.26.*only SHA-256, SHA-384, and SHA-512 are supported/,
    );
  });

  it('throws when hashAlgorithm is explicitly set to unsupported SHA-1', () => {
    const algId = buildPSSAlgorithmIdentifier('1.3.14.3.2.26');
    assert.throws(
      () => parseRSASSAPSSParams(algId.parameters),
      /unsupported hashAlgorithm OID.*only SHA-256, SHA-384, and SHA-512 are supported/,
    );
  });

  it('throws when saltLength exceeds hash digest length', () => {
    const algId = buildPSSAlgorithmIdentifier('2.16.840.1.101.3.4.2.1', 33);
    assert.throws(
      () => parseRSASSAPSSParams(algId.parameters),
      /saltLength 33 is out of valid range/,
    );
  });
});
