import crypto from 'crypto';
import { DetailedPeerCertificate } from 'tls';
import GlobalConfigTyped from '../../global_config_typed';

// PROTOTYPE(crl-result-cache):
// Caches the *result* of CRL validation per certificate so that repeat
// connections can skip the whole per-certificate path (cert decode, CRL
// fetch/decode, signature hashing, and the O(n) revoked-list scan).
//
// This whole file plus the small block in validateCrl() is additive so the
// prototype can be reverted by deleting this file and that block. Flip
// PROTOTYPE_CRL_RESULT_CACHE_ENABLED to false to A/B without removing code.
//
// Security profile: this is no weaker than caching the CRL itself, because a
// cached "valid" result is bounded by the same freshness window that a cached
// CRL would be trusted for (see setCrlResult). Only positive results are
// cached; a revoked/failed outcome throws and is never memoized.
export const PROTOTYPE_CRL_RESULT_CACHE_ENABLED = true;

export const CRL_RESULT_CACHE = new Map<string, { expireAt: number }>();

// The validation outcome depends on the exact certificate bytes and on
// allowCertificatesWithoutCrlURL (which flips the result for a cert that has no
// CRL distribution point), so both are part of the key. checkMode is
// intentionally excluded: validateCrl() returns the same true/throw regardless
// of ENABLED vs ADVISORY (the mode only changes how corkSocket reacts), and the
// in-memory/on-disk cache flags only affect performance, not the outcome.
export function getCrlResultCacheKey(
  certificate: DetailedPeerCertificate,
  allowCertificatesWithoutCrlURL: boolean,
): string {
  const fingerprint = crypto.createHash('sha256').update(certificate.raw).digest('hex');
  return `${fingerprint}|${allowCertificatesWithoutCrlURL}`;
}

export function getValidCrlResult(key: string): boolean {
  if (!PROTOTYPE_CRL_RESULT_CACHE_ENABLED) {
    return false;
  }
  const entry = CRL_RESULT_CACHE.get(key);
  if (!entry) {
    return false;
  }
  if (entry.expireAt > Date.now()) {
    return true;
  }
  CRL_RESULT_CACHE.delete(key);
  return false;
}

export function setCrlResult(key: string, earliestNextUpdate: number): void {
  if (!PROTOTYPE_CRL_RESULT_CACHE_ENABLED) {
    return;
  }
  // Never trust a cached "valid" longer than the CRL snapshot it was derived
  // from: bound by both the configured cache validity and the earliest
  // nextUpdate across every CRL that was consulted for this certificate.
  const expireAt = Math.min(
    Date.now() + GlobalConfigTyped.getValue('crlCacheValidityTime'),
    earliestNextUpdate,
  );
  CRL_RESULT_CACHE.set(key, { expireAt });
}

export function clearExpiredCrlResults(): void {
  const now = Date.now();
  CRL_RESULT_CACHE.forEach((entry, key) => {
    if (entry.expireAt < now) {
      CRL_RESULT_CACHE.delete(key);
    }
  });
}
