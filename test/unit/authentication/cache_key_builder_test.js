const assert = require('assert');
const {
  buildCacheKey,
  normalizeUrl,
  normalizeIdentifier,
  CacheTokenTypes,
} = require('../../../lib/authentication/cache_key_builder');

describe('cache_key_builder', function () {
  describe('normalizeUrl', function () {
    it('strips https scheme and lowercases host with port and path', function () {
      assert.strictEqual(
        normalizeUrl('https://login.microsoftonline.com:443/tenant-id/oauth2/v2.0'),
        'login.microsoftonline.com:443/tenant-id/oauth2/v2.0',
      );
    });

    it('strips http scheme and lowercases', function () {
      assert.strictEqual(normalizeUrl('http://example.com/path'), 'example.com/path');
    });

    it('omits trailing slash for bare host', function () {
      assert.strictEqual(
        normalizeUrl('https://myorg-myaccount.privatelink.snowflakecomputing.com'),
        'myorg-myaccount.privatelink.snowflakecomputing.com',
      );
    });

    it('omits trailing slash for host with trailing slash', function () {
      assert.strictEqual(
        normalizeUrl('https://myorg-myaccount.snowflakecomputing.com/'),
        'myorg-myaccount.snowflakecomputing.com',
      );
    });

    it('preserves explicit port and non-root path', function () {
      assert.strictEqual(
        normalizeUrl('https://account.snowflakecomputing.com/path/to/resource'),
        'account.snowflakecomputing.com/path/to/resource',
      );
    });

    it('handles URL without scheme', function () {
      assert.strictEqual(
        normalizeUrl('myorg.snowflakecomputing.com'),
        'myorg.snowflakecomputing.com',
      );
    });

    it('strips userinfo', function () {
      assert.strictEqual(
        normalizeUrl('https://user:pass@host.example.com/path'),
        'host.example.com/path',
      );
    });

    it('strips query string and fragment', function () {
      assert.strictEqual(
        normalizeUrl('https://host.example.com/path?query=1#frag'),
        'host.example.com/path',
      );
    });

    it('preserves @ in path (not treated as userinfo)', function () {
      assert.strictEqual(
        normalizeUrl('https://login.example.com/tenant@domain.com/oauth2/v2.0'),
        'login.example.com/tenant@domain.com/oauth2/v2.0',
      );
    });

    it('strips userinfo but preserves @ in path', function () {
      assert.strictEqual(
        normalizeUrl('https://user@login.example.com/path@with-at/resource'),
        'login.example.com/path@with-at/resource',
      );
    });

    it('strips scheme case-insensitively', function () {
      assert.strictEqual(normalizeUrl('HTTPS://host.example.com/path'), 'host.example.com/path');
    });

    it('lowercases non-URL input verbatim', function () {
      assert.strictEqual(normalizeUrl('NOT A URL'), 'not a url');
    });
  });

  describe('normalizeIdentifier', function () {
    it('lowercases plain identifier with no double quotes', function () {
      assert.strictEqual(normalizeIdentifier('user@domain.com'), 'user@domain.com');
    });

    it('lowercases all-uppercase unquoted identifier', function () {
      assert.strictEqual(normalizeIdentifier('USER@DOMAIN.COM'), 'user@domain.com');
    });

    it('returns value verbatim when it contains double quotes (starts with quote)', function () {
      // Contains " → entire value returned unchanged
      assert.strictEqual(normalizeIdentifier('"First Last"@domain.com'), '"First Last"@domain.com');
    });

    it('returns value verbatim when double quote is not at position 0', function () {
      // Quote anywhere in the string triggers verbatim path
      assert.strictEqual(normalizeIdentifier('prefix-"segment"'), 'prefix-"segment"');
    });

    it('returns value verbatim when it contains double quotes (role with quoted segment)', function () {
      assert.strictEqual(
        normalizeIdentifier('"Analyst Role With Spaces":north_america:prod:readonly'),
        '"Analyst Role With Spaces":north_america:prod:readonly',
      );
    });

    it('returns value verbatim for mixed-case quoted email', function () {
      assert.strictEqual(
        normalizeIdentifier('"First Last"@long-corporate-domain.example.com'),
        '"First Last"@long-corporate-domain.example.com',
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
    it('golden hash A — OAuth flow (DpopBundledAccessToken)', function () {
      assert.strictEqual(
        buildCacheKey({
          tokenType: 'DpopBundledAccessToken',
          idp: 'https://login.microsoftonline.com:443/tenant-id/oauth2/v2.0',
          snowflake: 'https://myorg-myaccount.privatelink.snowflakecomputing.com',
          username: '"First Last"@long-corporate-domain.example.com',
          role: '"Analyst Role With Spaces":north_america:prod:readonly',
        }),
        'SnowflakeTokenCache.v2.DpopBundledAccessToken.741b6d66d252666d6821bfd19e0151511cf4efdaaeba2b3c87673aa4de6d2c0b',
      );
    });

    it('golden hash B — MFA flow (MfaToken)', function () {
      assert.strictEqual(
        buildCacheKey({
          tokenType: 'MfaToken',
          idp: '',
          snowflake: 'https://myorg-myaccount.privatelink.snowflakecomputing.com',
          username: '"First Last"@long-corporate-domain.example.com',
          role: '',
        }),
        'SnowflakeTokenCache.v2.MfaToken.10c5dde84bb8f584c0df06ea826d418c4f580e08f9db10187c0cb5e2a732a0d6',
      );
    });

    it('key starts with versioned prefix including PascalCase token type', function () {
      const key = buildCacheKey({
        tokenType: CacheTokenTypes.ID_TOKEN,
        idp: '',
        snowflake: 'host.snowflakecomputing.com',
        username: 'testuser',
        role: '',
      });
      assert.ok(key.startsWith('SnowflakeTokenCache.v2.IdToken.'));
    });

    it('different snowflake hosts produce different keys', function () {
      const base = {
        tokenType: CacheTokenTypes.OAUTH_ACCESS_TOKEN,
        idp: 'idp.snowflakecomputing.com',
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
        idp: 'shared-idp.snowflakecomputing.com',
        username: 'user',
        role: '',
      };
      const key1 = buildCacheKey({ ...base, snowflake: 'org-account1.snowflakecomputing.com' });
      const key2 = buildCacheKey({ ...base, snowflake: 'org-account2.snowflakecomputing.com' });
      assert.notStrictEqual(key1, key2);
    });

    it('different roles produce different OAuth keys', function () {
      const base = {
        tokenType: CacheTokenTypes.OAUTH_ACCESS_TOKEN,
        idp: 'idp.snowflakecomputing.com',
        snowflake: 'account.snowflakecomputing.com',
        username: 'user',
      };
      const key1 = buildCacheKey({ ...base, role: 'role_a' });
      const key2 = buildCacheKey({ ...base, role: 'role_b' });
      assert.notStrictEqual(key1, key2);
    });

    it('MFA token key is stable across identical calls', function () {
      const params = {
        tokenType: CacheTokenTypes.MFA_TOKEN,
        idp: '',
        snowflake: 'account.snowflakecomputing.com',
        username: 'user',
        role: '',
      };
      assert.strictEqual(buildCacheKey(params), buildCacheKey(params));
    });

    it('MFA and OAuth keys differ for the same user and host', function () {
      const mfaKey = buildCacheKey({
        tokenType: CacheTokenTypes.MFA_TOKEN,
        idp: '',
        snowflake: 'account.snowflakecomputing.com',
        username: 'user',
        role: '',
      });
      const oauthKey = buildCacheKey({
        tokenType: CacheTokenTypes.OAUTH_ACCESS_TOKEN,
        idp: 'account.snowflakecomputing.com',
        snowflake: 'account.snowflakecomputing.com',
        username: 'user',
        role: '',
      });
      assert.notStrictEqual(mfaKey, oauthKey);
    });

    it('different token types produce different keys', function () {
      const base = {
        idp: '',
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
            idp: '',
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
            idp: '',
            snowflake: 'host.snowflakecomputing.com',
            username: '',
            role: '',
          }),
        /username must not be empty/,
      );
    });

    it('MFA key ignores idp and role values — only snowflake and username matter', function () {
      const keyWithEmptyIdp = buildCacheKey({
        tokenType: CacheTokenTypes.MFA_TOKEN,
        idp: '',
        snowflake: 'account.snowflakecomputing.com',
        username: 'user',
        role: '',
      });
      const keyWithIgnoredIdp = buildCacheKey({
        tokenType: CacheTokenTypes.MFA_TOKEN,
        idp: 'some-idp-that-is-ignored.snowflakecomputing.com',
        snowflake: 'account.snowflakecomputing.com',
        username: 'user',
        role: 'ignored_role',
      });
      assert.strictEqual(keyWithEmptyIdp, keyWithIgnoredIdp);
    });

    it('unquoted username and role are normalized to lowercase', function () {
      const keyLower = buildCacheKey({
        tokenType: CacheTokenTypes.OAUTH_ACCESS_TOKEN,
        idp: 'https://login.snowflakecomputing.com/oauth2',
        snowflake: 'https://account.snowflakecomputing.com',
        username: 'john.doe@example.com',
        role: 'analyst_role',
      });
      const keyUpper = buildCacheKey({
        tokenType: CacheTokenTypes.OAUTH_ACCESS_TOKEN,
        idp: 'https://login.snowflakecomputing.com/oauth2',
        snowflake: 'https://account.snowflakecomputing.com',
        username: 'JOHN.DOE@EXAMPLE.COM',
        role: 'ANALYST_ROLE',
      });
      assert.strictEqual(keyLower, keyUpper);
    });
  });

  describe('CacheTokenTypes', function () {
    it('has correct PascalCase canonical values', function () {
      assert.strictEqual(CacheTokenTypes.ID_TOKEN, 'IdToken');
      assert.strictEqual(CacheTokenTypes.MFA_TOKEN, 'MfaToken');
      assert.strictEqual(CacheTokenTypes.OAUTH_ACCESS_TOKEN, 'OauthAccessToken');
      assert.strictEqual(CacheTokenTypes.OAUTH_REFRESH_TOKEN, 'OauthRefreshToken');
    });
  });
});
