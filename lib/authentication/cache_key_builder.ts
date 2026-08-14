import * as crypto from 'crypto';

export enum CacheTokenType {
  ID_TOKEN = 'IdToken',
  MFA_TOKEN = 'MfaToken',
  OAUTH_ACCESS_TOKEN = 'OauthAccessToken',
  OAUTH_REFRESH_TOKEN = 'OauthRefreshToken',
}

const OAUTH_TYPES = new Set<CacheTokenType>([
  CacheTokenType.OAUTH_ACCESS_TOKEN,
  CacheTokenType.OAUTH_REFRESH_TOKEN,
]);

export interface CacheKeyInput {
  tokenType: CacheTokenType;
  snowflakeHost: string;
  oauthIdpUrl?: string;
  username?: string;
  role?: string;
}

/**
 * Normalizes a Snowflake identifier for use as a cache key component.
 *
 * In Snowflake, identifiers wrapped in double quotes (`"`) are case-sensitive,
 * while unquoted identifiers are case-insensitive.
 * e.g. `"MyRole"` is kept unchanged, while `MyRole` is lowercased to `myrole`.
 */
export function normalizeIdentifier(id: string): string {
  return id.includes('"') ? id : id.toLowerCase();
}

/**
 * Builds a versioned, SHA256-hashed cache key from the given inputs.
 *
 * The key format is:
 *   `SnowflakeTokenCache.v2.<TokenType>.<sha256hex>`
 *
 * Return null if user provided input shound't be cached.
 */
export function buildCacheKey(input: CacheKeyInput): string | null {
  if (!input.username) {
    return null;
  }

  const keyData: Record<string, string | undefined> = {
    snowflakeHost: input.snowflakeHost,
    username: normalizeIdentifier(input.username),
  };

  if (OAUTH_TYPES.has(input.tokenType)) {
    keyData.oauthIdpUrl = input.oauthIdpUrl;
    keyData.role = input.role ? normalizeIdentifier(input.role) : undefined;
  }

  const hash = crypto.createHash('sha256').update(JSON.stringify(keyData), 'utf8').digest('hex');
  return `SnowflakeTokenCache.v2.${input.tokenType}.${hash}`;
}
