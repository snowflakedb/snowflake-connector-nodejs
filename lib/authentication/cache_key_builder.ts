import * as crypto from 'crypto';

/** Canonical token type strings for the v2 cache key contract. */
export const CacheTokenTypes = {
  ID_TOKEN: 'ID_TOKEN',
  MFA_TOKEN: 'MFA_TOKEN',
  OAUTH_ACCESS_TOKEN: 'OAUTH_ACCESS_TOKEN',
  OAUTH_REFRESH_TOKEN: 'OAUTH_REFRESH_TOKEN',
} as const;

/** OAuth flows that require idp + role in keyData. */
const OAUTH_TYPES = new Set([
  'OAUTH_ACCESS_TOKEN',
  'OAUTH_REFRESH_TOKEN',
  'DPOP_BUNDLED_ACCESS_TOKEN',
]);

export interface CacheKeyInput {
  /** Canonical wire string, e.g. 'MFA_TOKEN', 'OAUTH_ACCESS_TOKEN'. */
  tokenType: string;
  /**
   * Raw IdP/token-endpoint URL (full URL, not just hostname).
   * Required for OAuth flows; pass an empty string for MFA and ID token flows.
   */
  idp: string;
  /** Raw Snowflake server URL (the host you connect to). */
  snowflake: string;
  /** Raw Snowflake username. */
  username: string;
  /** Raw role; empty string when role is not applicable (e.g. MFA, ID token). */
  role: string;
}

/**
 * Normalizes a URL for use as a cache key component.
 *
 * Strips scheme, userinfo, query string, and fragment. Trims a root-only
 * trailing slash. Uppercases the remainder. Preserves explicit ports and paths.
 */
export function normalizeUrl(url: string): string {
  // Strip scheme (case-insensitive: https://, HTTPS://, etc.)
  const schemeEnd = url.indexOf('://');
  let s = schemeEnd >= 0 ? url.slice(schemeEnd + 3) : url;

  // Strip query string and fragment before any other processing.
  s = s.split('?')[0].split('#')[0];

  // Strip userinfo ("user:pass@") from the authority only. The authority ends
  // at the first '/', so an '@' after that first '/' is part of the path and
  // must be preserved.
  const firstSlash = s.indexOf('/');
  const authorityEnd = firstSlash >= 0 ? firstSlash : s.length;
  const authority = s.slice(0, authorityEnd);
  const path = s.slice(authorityEnd);
  const atInAuthority = authority.indexOf('@');
  const normalizedAuthority = atInAuthority >= 0 ? authority.slice(atInAuthority + 1) : authority;

  s = normalizedAuthority + path;

  // Trim a root-only trailing slash so bare-host URLs have no slash suffix.
  s = s.replace(/\/$/, '');
  return s.toUpperCase();
}

/**
 * Normalizes a Snowflake identifier for use as a cache key component.
 *
 * Uppercases characters outside double-quoted segments; preserves the contents
 * of `"..."` segments verbatim (including their surrounding quotes).
 */
export function normalizeIdentifier(id: string): string {
  let result = '';
  let inQuotes = false;
  for (const ch of id) {
    if (ch === '"') {
      inQuotes = !inQuotes;
      result += ch;
    } else if (inQuotes) {
      result += ch;
    } else {
      result += ch.toUpperCase();
    }
  }
  return result;
}

/**
 * Builds a versioned, SHA256-hashed cache key from the given inputs.
 *
 * The key format is:
 *   `SnowflakeTokenCache.v2.<TOKEN_TYPE>.<sha256hex>`
 *
 * where the hash is computed over a compact, sorted-key canonical JSON document.
 * The `keyData` fields differ by flow:
 * - OAuth flows (`OAUTH_ACCESS_TOKEN`, `OAUTH_REFRESH_TOKEN`, `DPOP_BUNDLED_ACCESS_TOKEN`):
 *   `{ idp, role, snowflake, username }` (4 fields).
 * - MFA and ID token flows (`MFA_TOKEN`, `ID_TOKEN`):
 *   `{ snowflake, username }` (2 fields; idp and role are excluded).
 *
 * This key is used verbatim by both the OS keystore and JSON file backends;
 * hashing occurs exactly once here.
 *
 * @throws {Error} if `snowflake` or `username` is empty.
 */
export function buildCacheKey(input: CacheKeyInput): string {
  if (!input.snowflake) {
    throw new Error('snowflake URL must not be empty');
  }
  if (!input.username) {
    throw new Error('username must not be empty');
  }

  let keyData: Record<string, string>;
  if (OAUTH_TYPES.has(input.tokenType)) {
    keyData = {
      idp: normalizeUrl(input.idp || ''),
      role: normalizeIdentifier(input.role || ''),
      snowflake: normalizeUrl(input.snowflake),
      username: normalizeIdentifier(input.username),
    };
  } else {
    // MFA_TOKEN, ID_TOKEN — no idp or role in keyData
    keyData = {
      snowflake: normalizeUrl(input.snowflake),
      username: normalizeIdentifier(input.username),
    };
  }

  // Sort keys explicitly — JSON.stringify does NOT guarantee sorted order
  const sortedKeys = Object.keys(keyData).sort();
  const canonical =
    '{' +
    sortedKeys.map((k) => JSON.stringify(k) + ':' + JSON.stringify(keyData[k])).join(',') +
    '}';

  const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `SnowflakeTokenCache.v2.${input.tokenType}.${hash}`;
}
