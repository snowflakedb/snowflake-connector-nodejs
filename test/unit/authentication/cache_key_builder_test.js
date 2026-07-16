const assert = require('assert');
const {
  buildCacheKey,
  normalizeUrl,
  normalizeIdentifier,
  CacheTokenTypes,
} = require('../../../lib/authentication/cache_key_builder');

describe('cache_key_builder', function () {
  describe('normalizeUrl', function () {
    it('strips https scheme and uppercases host with port and path', function () {
      assert.strictEqual(
        normalizeUrl('https://login.microsoftonline.com:443/tenant-id/oauth2/v2.0'),
        'LOGIN.MICROSOFTONLINE.COM:443/TENANT-ID/OAUTH2/V2.0',
      );
    });

    it('strips http scheme and uppercases', function () {
      assert.strictEqual(normalizeUrl('http://example.com/path'), 'EXAMPLE.COM/PATH');
    });

    it('omits trailing slash for bare host', function () {
      assert.strictEqual(
        normalizeUrl('https://myorg-myaccount.privatelink.snowflakecomputing.com'),
        'MYORG-MYACCOUNT.PRIVATELINK.SNOWFLAKECOMPUTING.COM',
      );
    });

    it('omits trailing slash for host with trailing slash', function () {
      assert.strictEqual(
        normalizeUrl('https://myorg-myaccount.snowflakecomputing.com/'),
        'MYORG-MYACCOUNT.SNOWFLAKECOMPUTING.COM',
      );
    });

    it('preserves explicit port and non-root path', function () {
      assert.strictEqual(
        normalizeUrl('https://account.snowflakecomputing.com/path/to/resource'),
        'ACCOUNT.SNOWFLAKECOMPUTING.COM/PATH/TO/RESOURCE',
      );
    });

    it('handles URL without scheme', function () {
      assert.strictEqual(
        normalizeUrl('myorg.snowflakecomputing.com'),
        'MYORG.SNOWFLAKECOMPUTING.COM',
      );
    });

    it('strips userinfo', function () {
      assert.strictEqual(
        normalizeUrl('https://user:pass@host.example.com/path'),
        'HOST.EXAMPLE.COM/PATH',
      );
    });

    it('strips query string and fragment', function () {
      assert.strictEqual(
        normalizeUrl('https://host.example.com/path?query=1#frag'),
        'HOST.EXAMPLE.COM/PATH',
      );
    });

    it('uppercases non-URL input verbatim', function () {
      assert.strictEqual(normalizeUrl('not a url'), 'NOT A URL');
    });
  });

  describe('normalizeIdentifier', function () {
    it('uppercases plain identifier', function () {
      assert.strictEqual(normalizeIdentifier('user@domain.com'), 'USER@DOMAIN.COM');
    });

    it('preserves double-quoted segment verbatim', function () {
      assert.strictEqual(normalizeIdentifier('"First Last"@domain.com'), '"First Last"@DOMAIN.COM');
    });

    it('handles multiple quoted and unquoted segments', function () {
      assert.strictEqual(
        normalizeIdentifier('"Analyst Role With Spaces":north_america:prod:readonly'),
        '"Analyst Role With Spaces":NORTH_AMERICA:PROD:READONLY',
      );
    });

    it('already-uppercased input is unchanged', function () {
      assert.strictEqual(normalizeIdentifier('USER@DOMAIN.COM'), 'USER@DOMAIN.COM');
    });

    it('empty string returns empty string', function () {
      assert.strictEqual(normalizeIdentifier(''), '');
    });
  });

  describe('buildCacheKey', function () {
    it('produces the expected hash for a known golden input', function () {
      // normalizeIdentifier preserves double-quoted content verbatim, so the
      // raw input must carry the uppercase form to produce the expected hash.
      assert.strictEqual(
        buildCacheKey({
          tokenType: 'DPOP_BUNDLED_ACCESS_TOKEN',
          idp: 'https://login.microsoftonline.com:443/tenant-id/oauth2/v2.0',
          snowflake: 'https://myorg-myaccount.privatelink.snowflakecomputing.com',
          username: '"FIRST LAST"@long-corporate-domain.example.com',
          role: '"ANALYST ROLE WITH SPACES":north_america:prod:readonly',
        }),
        'SnowflakeTokenCache.v2.75ff2ad65a68afb402f125f62894697673c5ef3d863aba466d16b7a81053d1f4',
      );
    });

    it('key starts with versioned prefix', function () {
      const key = buildCacheKey({
        tokenType: CacheTokenTypes.ID_TOKEN,
        idp: 'host.example.com',
        snowflake: 'host.example.com',
        username: 'testuser',
        role: '',
      });
      assert.ok(key.startsWith('SnowflakeTokenCache.v2.'));
    });

    it('different snowflake hosts produce different keys', function () {
      const base = {
        tokenType: CacheTokenTypes.OAUTH_ACCESS_TOKEN,
        idp: 'idp.example.com',
        username: 'user',
        role: '',
      };
      const key1 = buildCacheKey({ ...base, snowflake: 'account1.snowflakecomputing.com' });
      const key2 = buildCacheKey({ ...base, snowflake: 'account2.snowflakecomputing.com' });
      assert.notStrictEqual(key1, key2);
    });

    it('same IdP with different snowflake hosts produce different keys', function () {
      const base = {
        tokenType: CacheTokenTypes.OAUTH_ACCESS_TOKEN,
        idp: 'shared-idp.example.com',
        username: 'user',
        role: '',
      };
      const key1 = buildCacheKey({ ...base, snowflake: 'org-account1.snowflakecomputing.com' });
      const key2 = buildCacheKey({ ...base, snowflake: 'org-account2.snowflakecomputing.com' });
      assert.notStrictEqual(key1, key2);
    });

    it('different roles produce different keys', function () {
      const base = {
        tokenType: CacheTokenTypes.OAUTH_ACCESS_TOKEN,
        idp: 'idp.example.com',
        snowflake: 'account.snowflakecomputing.com',
        username: 'user',
      };
      const key1 = buildCacheKey({ ...base, role: 'ROLE_A' });
      const key2 = buildCacheKey({ ...base, role: 'ROLE_B' });
      assert.notStrictEqual(key1, key2);
    });

    it('MFA with empty role produces a stable key', function () {
      const key = buildCacheKey({
        tokenType: CacheTokenTypes.MFA_TOKEN,
        idp: 'account.snowflakecomputing.com',
        snowflake: 'account.snowflakecomputing.com',
        username: 'user',
        role: '',
      });
      assert.ok(key.startsWith('SnowflakeTokenCache.v2.'));
      const key2 = buildCacheKey({
        tokenType: CacheTokenTypes.MFA_TOKEN,
        idp: 'account.snowflakecomputing.com',
        snowflake: 'account.snowflakecomputing.com',
        username: 'user',
        role: '',
      });
      assert.strictEqual(key, key2);
    });

    it('different token types produce different keys', function () {
      const base = {
        idp: 'account.snowflakecomputing.com',
        snowflake: 'account.snowflakecomputing.com',
        username: 'user',
        role: '',
      };
      const key1 = buildCacheKey({ ...base, tokenType: CacheTokenTypes.ID_TOKEN });
      const key2 = buildCacheKey({ ...base, tokenType: CacheTokenTypes.MFA_TOKEN });
      assert.notStrictEqual(key1, key2);
    });

    it('throws when snowflake is empty', function () {
      assert.throws(
        () =>
          buildCacheKey({
            tokenType: CacheTokenTypes.ID_TOKEN,
            idp: 'host',
            snowflake: '',
            username: 'user',
            role: '',
          }),
        /snowflake URL must not be empty/,
      );
    });

    it('throws when username is empty', function () {
      assert.throws(
        () =>
          buildCacheKey({
            tokenType: CacheTokenTypes.ID_TOKEN,
            idp: 'host',
            snowflake: 'host',
            username: '',
            role: '',
          }),
        /username must not be empty/,
      );
    });
  });

  describe('CacheTokenTypes', function () {
    it('has correct canonical values', function () {
      assert.strictEqual(CacheTokenTypes.ID_TOKEN, 'ID_TOKEN');
      assert.strictEqual(CacheTokenTypes.MFA_TOKEN, 'MFA_TOKEN');
      assert.strictEqual(CacheTokenTypes.OAUTH_ACCESS_TOKEN, 'OAUTH_ACCESS_TOKEN');
      assert.strictEqual(CacheTokenTypes.OAUTH_REFRESH_TOKEN, 'OAUTH_REFRESH_TOKEN');
    });
  });
});
