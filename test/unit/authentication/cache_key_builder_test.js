const assert = require('assert');
const {
  buildCacheKey,
  normalizeIdentifier,
  CacheTokenType,
} = require('../../../lib/authentication/cache_key_builder');

describe('cache_key_builder', function () {
  describe('normalizeIdentifier', function () {
    it('lowercases plain identifier with no double quotes', function () {
      assert.strictEqual(normalizeIdentifier('user@domain.com'), 'user@domain.com');
    });

    it('lowercases all-uppercase unquoted identifier', function () {
      assert.strictEqual(normalizeIdentifier('USER@DOMAIN.COM'), 'user@domain.com');
    });

    it('returns value verbatim when it contains double quotes (starts with quote)', function () {
      assert.strictEqual(normalizeIdentifier('"First Last"@domain.com'), '"First Last"@domain.com');
    });

    it('returns value verbatim when double quote is not at position 0', function () {
      assert.strictEqual(normalizeIdentifier('prefix-"segment"'), 'prefix-"segment"');
    });

    it('returns value verbatim when it contains double quotes (role with quoted segment)', function () {
      assert.strictEqual(
        normalizeIdentifier('"Analyst Role With Spaces":north_america:prod:readonly'),
        '"Analyst Role With Spaces":north_america:prod:readonly',
      );
    });

    it('lowercases plain role without double quotes', function () {
      assert.strictEqual(normalizeIdentifier('ANALYST_ROLE'), 'analyst_role');
    });

    it('empty string returns empty string', function () {
      assert.strictEqual(normalizeIdentifier(''), '');
    });
  });

  describe('buildCacheKey', function () {
    it('golden hash — OAuth flow includes idp and role', function () {
      assert.strictEqual(
        buildCacheKey({
          tokenType: CacheTokenType.OAUTH_ACCESS_TOKEN,
          oauthIdpUrl: 'https://login.microsoftonline.com:443/tenant-id/oauth2/v2.0',
          snowflakeHost: 'https://myorg-myaccount.privatelink.snowflakecomputing.com',
          username: '"First Last"@long-corporate-domain.example.com',
          role: '"Analyst Role With Spaces":north_america:prod:readonly',
        }),
        'SnowflakeTokenCache.v2.OauthAccessToken.c44ef3608ba325763c860284bac6a2382e2342cd28522b8532b11e07ce8500ab',
      );
    });

    it('golden hash — MFA flow uses only host and username', function () {
      assert.strictEqual(
        buildCacheKey({
          tokenType: CacheTokenType.MFA_TOKEN,
          snowflakeHost: 'https://myorg-myaccount.privatelink.snowflakecomputing.com',
          username: '"First Last"@long-corporate-domain.example.com',
        }),
        'SnowflakeTokenCache.v2.MfaToken.6ff1055a78ef8ed306fbfa507fd7eed2e75ef65b919a77af047b2d82f6788d24',
      );
    });

    it('key starts with versioned prefix including PascalCase token type', function () {
      const key = buildCacheKey({
        tokenType: CacheTokenType.ID_TOKEN,
        snowflakeHost: 'host.snowflakecomputing.com',
        username: 'testuser',
      });
      assert.ok(key.startsWith('SnowflakeTokenCache.v2.IdToken.'));
    });

    it('different snowflake hosts produce different keys', function () {
      const base = {
        tokenType: CacheTokenType.OAUTH_ACCESS_TOKEN,
        oauthIdpUrl: 'idp.snowflakecomputing.com',
        username: 'user',
      };
      const key1 = buildCacheKey({ ...base, snowflakeHost: 'account1.snowflakecomputing.com' });
      const key2 = buildCacheKey({ ...base, snowflakeHost: 'account2.snowflakecomputing.com' });
      assert.notStrictEqual(key1, key2);
    });

    it('same IdP with different snowflake hosts produce different keys', function () {
      const base = {
        tokenType: CacheTokenType.OAUTH_ACCESS_TOKEN,
        oauthIdpUrl: 'shared-idp.snowflakecomputing.com',
        username: 'user',
      };
      const key1 = buildCacheKey({ ...base, snowflakeHost: 'org-account1.snowflakecomputing.com' });
      const key2 = buildCacheKey({ ...base, snowflakeHost: 'org-account2.snowflakecomputing.com' });
      assert.notStrictEqual(key1, key2);
    });

    it('different roles produce different OAuth keys', function () {
      const base = {
        tokenType: CacheTokenType.OAUTH_ACCESS_TOKEN,
        oauthIdpUrl: 'idp.snowflakecomputing.com',
        snowflakeHost: 'account.snowflakecomputing.com',
        username: 'user',
      };
      const key1 = buildCacheKey({ ...base, role: 'role_a' });
      const key2 = buildCacheKey({ ...base, role: 'role_b' });
      assert.notStrictEqual(key1, key2);
    });

    it('MFA token key is stable across identical calls', function () {
      const params = {
        tokenType: CacheTokenType.MFA_TOKEN,
        snowflakeHost: 'account.snowflakecomputing.com',
        username: 'user',
      };
      assert.strictEqual(buildCacheKey(params), buildCacheKey(params));
    });

    it('MFA and OAuth keys differ for the same user and host', function () {
      const mfaKey = buildCacheKey({
        tokenType: CacheTokenType.MFA_TOKEN,
        snowflakeHost: 'account.snowflakecomputing.com',
        username: 'user',
      });
      const oauthKey = buildCacheKey({
        tokenType: CacheTokenType.OAUTH_ACCESS_TOKEN,
        oauthIdpUrl: 'account.snowflakecomputing.com',
        snowflakeHost: 'account.snowflakecomputing.com',
        username: 'user',
      });
      assert.notStrictEqual(mfaKey, oauthKey);
    });

    it('different token types produce different keys', function () {
      const base = {
        snowflakeHost: 'account.snowflakecomputing.com',
        username: 'user',
      };
      const key1 = buildCacheKey({ ...base, tokenType: CacheTokenType.ID_TOKEN });
      const key2 = buildCacheKey({ ...base, tokenType: CacheTokenType.MFA_TOKEN });
      assert.notStrictEqual(key1, key2);
    });

    it('returns null when username is empty', function () {
      const key = buildCacheKey({
        tokenType: CacheTokenType.ID_TOKEN,
        snowflakeHost: 'host.snowflakecomputing.com',
        username: '',
      });
      assert.strictEqual(key, null);
    });

    it('returns null when username is missing', function () {
      const key = buildCacheKey({
        tokenType: CacheTokenType.ID_TOKEN,
        snowflakeHost: 'host.snowflakecomputing.com',
      });
      assert.strictEqual(key, null);
    });

    it('MFA key ignores idp and role — only host and username matter', function () {
      const keyWithoutOauthFields = buildCacheKey({
        tokenType: CacheTokenType.MFA_TOKEN,
        snowflakeHost: 'account.snowflakecomputing.com',
        username: 'user',
      });
      const keyWithIgnoredOauthFields = buildCacheKey({
        tokenType: CacheTokenType.MFA_TOKEN,
        oauthIdpUrl: 'some-idp-that-is-ignored.snowflakecomputing.com',
        snowflakeHost: 'account.snowflakecomputing.com',
        username: 'user',
        role: 'ignored_role',
      });
      assert.strictEqual(keyWithoutOauthFields, keyWithIgnoredOauthFields);
    });

    it('unquoted username and role are normalized to lowercase', function () {
      const keyLower = buildCacheKey({
        tokenType: CacheTokenType.OAUTH_ACCESS_TOKEN,
        oauthIdpUrl: 'https://login.snowflakecomputing.com/oauth2',
        snowflakeHost: 'https://account.snowflakecomputing.com',
        username: 'john.doe@example.com',
        role: 'analyst_role',
      });
      const keyUpper = buildCacheKey({
        tokenType: CacheTokenType.OAUTH_ACCESS_TOKEN,
        oauthIdpUrl: 'https://login.snowflakecomputing.com/oauth2',
        snowflakeHost: 'https://account.snowflakecomputing.com',
        username: 'JOHN.DOE@EXAMPLE.COM',
        role: 'ANALYST_ROLE',
      });
      assert.strictEqual(keyLower, keyUpper);
    });
  });

  describe('CacheTokenType', function () {
    it('has correct PascalCase canonical values', function () {
      assert.strictEqual(CacheTokenType.ID_TOKEN, 'IdToken');
      assert.strictEqual(CacheTokenType.MFA_TOKEN, 'MfaToken');
      assert.strictEqual(CacheTokenType.OAUTH_ACCESS_TOKEN, 'OauthAccessToken');
      assert.strictEqual(CacheTokenType.OAUTH_REFRESH_TOKEN, 'OauthRefreshToken');
    });
  });
});
