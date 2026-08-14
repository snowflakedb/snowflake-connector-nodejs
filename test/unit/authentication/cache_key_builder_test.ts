import assert from 'assert';
import {
  buildCacheKey,
  normalizeIdentifier,
  CacheTokenType,
} from '../../../lib/authentication/cache_key_builder';

describe('cache_key_builder', () => {
  describe('normalizeIdentifier', () => {
    const cases: { name: string; input: string; expected: string }[] = [
      {
        name: 'lowercases plain identifier with no double quotes',
        input: 'user@domain.com',
        expected: 'user@domain.com',
      },
      {
        name: 'lowercases all-uppercase unquoted identifier',
        input: 'USER@DOMAIN.COM',
        expected: 'user@domain.com',
      },
      {
        name: 'keeps value unchanged when it contains double quotes (starts with quote)',
        input: '"First Last"@domain.com',
        expected: '"First Last"@domain.com',
      },
      {
        name: 'keeps value unchanged when double quote is not at position 0',
        input: 'prefix-"segment"',
        expected: 'prefix-"segment"',
      },
      {
        name: 'keeps value unchanged when it contains double quotes (role with quoted segment)',
        input: '"Analyst Role With Spaces":north_america:prod:readonly',
        expected: '"Analyst Role With Spaces":north_america:prod:readonly',
      },
      {
        name: 'lowercases plain role without double quotes',
        input: 'ANALYST_ROLE',
        expected: 'analyst_role',
      },
      {
        name: 'empty string returns empty string',
        input: '',
        expected: '',
      },
    ];

    cases.forEach(({ name, input, expected }) => {
      it(name, () => {
        assert.strictEqual(normalizeIdentifier(input), expected);
      });
    });
  });

  describe('buildCacheKey', () => {
    it('OAuth key matches known value for fixed input', () => {
      assert.strictEqual(
        buildCacheKey({
          tokenType: CacheTokenType.OAUTH_ACCESS_TOKEN,
          oauthIdpUrl: 'https://login.microsoftonline.com:443/tenant-id/oauth2/v2.0',
          snowflakeHost: 'https://myorg-myaccount.privatelink.snowflakecomputing.com',
          username: '"First Last"@long-corporate-domain.snowflake.com',
          role: '"Analyst Role With Spaces":north_america:prod:readonly',
        }),
        'SnowflakeTokenCache.v2.OauthAccessToken.a12086c6d9b5b5795fdf6c9261c2f2475c9416a55b7aeadd20b1968da544a685',
      );
    });

    it('MFA key matches known value for fixed input', () => {
      assert.strictEqual(
        buildCacheKey({
          tokenType: CacheTokenType.MFA_TOKEN,
          snowflakeHost: 'https://myorg-myaccount.privatelink.snowflakecomputing.com',
          username: '"First Last"@long-corporate-domain.snowflake.com',
        }),
        'SnowflakeTokenCache.v2.MfaToken.e8481f3017956e81c79c5b31faba3c7a6c504a1950bf4ab80daedc8e59e1fc40',
      );
    });

    it('OAuth key changes when snowflake host changes', () => {
      const base = {
        tokenType: CacheTokenType.OAUTH_ACCESS_TOKEN,
        oauthIdpUrl: 'idp.snowflakecomputing.com',
        username: 'user',
      };
      const key1 = buildCacheKey({ ...base, snowflakeHost: 'account1.snowflakecomputing.com' });
      const key2 = buildCacheKey({ ...base, snowflakeHost: 'account2.snowflakecomputing.com' });
      assert.notStrictEqual(key1, key2);
    });

    it('OAuth key changes when role changes', () => {
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

    it('different token types produce different keys', () => {
      const base = {
        snowflakeHost: 'account.snowflakecomputing.com',
        username: 'user',
      };
      const key1 = buildCacheKey({ ...base, tokenType: CacheTokenType.ID_TOKEN });
      const key2 = buildCacheKey({ ...base, tokenType: CacheTokenType.MFA_TOKEN });
      assert.notStrictEqual(key1, key2);
    });

    it('returns null when username is empty', () => {
      const key = buildCacheKey({
        tokenType: CacheTokenType.ID_TOKEN,
        snowflakeHost: 'host.snowflakecomputing.com',
        username: '',
      });
      assert.strictEqual(key, null);
    });

    it('returns null when username is missing', () => {
      const key = buildCacheKey({
        tokenType: CacheTokenType.ID_TOKEN,
        snowflakeHost: 'host.snowflakecomputing.com',
      });
      assert.strictEqual(key, null);
    });

    it('MFA key ignores idp and role — only host and username matter', () => {
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

    it('unquoted username and role are normalized to lowercase', () => {
      const keyLower = buildCacheKey({
        tokenType: CacheTokenType.OAUTH_ACCESS_TOKEN,
        oauthIdpUrl: 'https://login.snowflakecomputing.com/oauth2',
        snowflakeHost: 'https://account.snowflakecomputing.com',
        username: 'john.doe@snowflake.com',
        role: 'analyst_role',
      });
      const keyUpper = buildCacheKey({
        tokenType: CacheTokenType.OAUTH_ACCESS_TOKEN,
        oauthIdpUrl: 'https://login.snowflakecomputing.com/oauth2',
        snowflakeHost: 'https://account.snowflakecomputing.com',
        username: 'JOHN.DOE@SNOWFLAKE.COM',
        role: 'ANALYST_ROLE',
      });
      assert.strictEqual(keyLower, keyUpper);
    });
  });
});
