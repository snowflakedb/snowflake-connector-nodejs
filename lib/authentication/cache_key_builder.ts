import * as crypto from 'crypto';

/**
 * Canonical token type strings for the v2 cache key contract.
 * These must match the cross-driver spec exactly.
 */
export const CacheTokenTypes = {
  ID_TOKEN: 'ID_TOKEN',
  MFA_TOKEN: 'MFA_TOKEN',
  OAUTH_ACCESS_TOKEN: 'OAUTH_ACCESS_TOKEN',
  OAUTH_REFRESH_TOKEN: 'OAUTH_REFRESH_TOKEN',
} as const;

export interface CacheKeyInput {
  /** Canonical wire string, e.g. 'MFA_TOKEN', 'OAUTH_ACCESS_TOKEN'. */
  tokenType: string;
  /** Raw IdP/token-endpoint URL. For non-OAuth flows, equals the Snowflake server URL. */
  idp: string;
  /** Raw Snowflake server URL (the host you connect to). */
  snowflake: string;
  /** Raw Snowflake username. */
  username: string;
  /** Raw role; empty string when role is not applicable (e.g. MFA). */
  role: string;
}

/**
 * Normalizes a URL for use as a cache key component.
 *
 * Strips scheme, userinfo, query string, and fragment. Trims a root-only
 * trailing slash. Uppercases the remainder. Preserves explicit ports and paths.
 *
 * Cross-driver spec §2.3: strip scheme, strip userinfo, drop query/fragment,
 * trim root slash, uppercase remainder.
 */
export function normalizeUrl(url: string): string {
  let s = url.replace(/^https?:\/\//, '');

  const atIdx = s.indexOf('@');
  if (atIdx >= 0) {
    s = s.slice(atIdx + 1);
  }

  s = s.split('?')[0].split('#')[0];

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
 * The key format is `SnowflakeTokenCache.v2.<sha256hex>` where the hash is
 * computed over a compact, sorted-key canonical JSON document. This key is
 * used verbatim by both the OS keystore and JSON file backends.
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

  const keyData: Record<string, string> = {
    idp: normalizeUrl(input.idp),
    role: normalizeIdentifier(input.role),
    snowflake: normalizeUrl(input.snowflake),
    token_type: input.tokenType,
    username: normalizeIdentifier(input.username),
  };

  const sortedKeys = Object.keys(keyData).sort();
  const canonical =
    '{' +
    sortedKeys.map((k) => JSON.stringify(k) + ':' + JSON.stringify(keyData[k])).join(',') +
    '}';

  const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `SnowflakeTokenCache.v2.${hash}`;
}
