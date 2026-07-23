import * as crypto from 'crypto';

/**
 * PascalCase token type strings for the v2 cache key prefix.
 * The property names are kept for backward compatibility with call sites;
 * the string values are the PascalCase segments written into the key.
 */
export const CacheTokenTypes = {
  ID_TOKEN: 'IdToken',
  MFA_TOKEN: 'MfaToken',
  OAUTH_ACCESS_TOKEN: 'OauthAccessToken',
  OAUTH_REFRESH_TOKEN: 'OauthRefreshToken',
} as const;

/** OAuth flows that require idp + role in keyData. */
const OAUTH_TYPES = new Set(['OauthAccessToken', 'OauthRefreshToken', 'DpopBundledAccessToken']);

export interface CacheKeyInput {
  /**
   * PascalCase token type string written into the key prefix,
   * e.g. 'MfaToken', 'OauthAccessToken'. Use `CacheTokenTypes` constants or
   * pass the literal for types not covered by the enum (e.g. 'DpopBundledAccessToken').
   */
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
  /** Raw role; empty string when role is not applicable (e.g. MfaToken, IdToken). */
  role: string;
}

/**
 * Normalizes a URL for use as a cache key component.
 *
 * Strips scheme, userinfo, query string, and fragment. Trims a root-only
 * trailing slash. Lowercases the remainder. Preserves explicit ports and paths.
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
  return s.toLowerCase();
}

/**
 * Normalizes a Snowflake identifier for use as a cache key component.
 *
 * Values that contain at least one double-quote character (`"`) are returned
 * **verbatim** — they carry case-sensitive SQL semantics and must not be altered.
 * Values without any double quotes are **lowercased** — they are case-insensitive
 * in Snowflake, so lowercasing produces a stable canonical form.
 */
export function normalizeIdentifier(id: string): string {
  // Quoted identifiers have case-sensitive semantics — return verbatim.
  // Unquoted identifiers are case-insensitive in Snowflake — lowercase for canonical form.
  return id.includes('"') ? id : id.toLowerCase();
}

/**
 * Builds a versioned, SHA256-hashed cache key from the given inputs.
 *
 * The key format is:
 *   `SnowflakeTokenCache.v2.<TokenType>.<sha256hex>`
 *
 * where `<TokenType>` is PascalCase (e.g. `MfaToken`, `OauthAccessToken`) and the
 * hash is computed over a compact, sorted-key canonical JSON document.
 * The `keyData` fields differ by flow:
 * - OAuth flows (`OauthAccessToken`, `OauthRefreshToken`, `DpopBundledAccessToken`):
 *   `{ idp, role, snowflake, username }` (4 fields).
 * - MFA and ID token flows (`MfaToken`, `IdToken`):
 *   `{ snowflake, username }` (2 fields; idp and role are excluded).
 *
 * `normalizeUrl` lowercases its output; `normalizeIdentifier` returns verbatim for
 * values containing double quotes, and lowercases everything else.
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
    // MfaToken, IdToken — no idp or role in keyData
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
