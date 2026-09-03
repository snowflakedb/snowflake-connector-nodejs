import assert from 'assert';
import sinon from 'sinon';
import {
  resetAllowedHostSuffixesCache,
  SNOWFLAKE_WIF_ALLOWED_HOST_SUFFIXES_ENV_VAR,
  validateAccessUrl,
} from '../../../../lib/authentication/auth_workload_identity/host_allowlist';

describe('validateAccessUrl', () => {
  function stubAllowlistEnv(suffixes: string) {
    sinon.stub(process, 'env').value({
      ...process.env,
      [SNOWFLAKE_WIF_ALLOWED_HOST_SUFFIXES_ENV_VAR]: suffixes,
    });
  }

  afterEach(() => {
    sinon.restore();
    resetAllowedHostSuffixesCache();
  });

  const acceptedHosts = [
    'myorg-acct.snowflakecomputing.com',
    'myorg-acct.privatelink.snowflakecomputing.com',
    'acct.us-east-1.snowflakecomputing.com',
    'acct.snowflakecomputing.cn',
    'acct.snowflakecomputing.mil',
    'acct.some-region.privatelink.snowflakecomputing.mil',
    'snowflakecomputing.com',
    'ACCT.SnowflakeComputing.COM',
    'acct.snowflakecomputing.com.',
    // FQDN form (trailing dot) combined with an explicit port. The URL parser drops the port from
    // the hostname and the trailing dot is normalized away, so this is still accepted.
    'acct.snowflakecomputing.com.:443',
  ];

  acceptedHosts.forEach((host) => {
    it(`accepts ${host}`, () => {
      assert.doesNotThrow(() => validateAccessUrl(`https://${host}`));
    });
  });

  const rejectedHosts = [
    'evilsnowflakecomputing.com',
    'acct.snowflakecomputing.com.attacker.example',
    'evil.snowflakecomputing.attacker.example',
    'acct.snowflakecomputing.zip',
    'attacker.example',
    'snowflakecomputing.com.evil.io',
    '',
    '127.0.0.1',
    'xsnowflakecomputing.mil',
    'acct.snowflakecomputing.co',
  ];

  rejectedHosts.forEach((host) => {
    it(`rejects ${JSON.stringify(host)}`, () => {
      assert.throws(() => validateAccessUrl(`https://${host}`));
    });
  });

  describe('SNOWFLAKE_WIF_ALLOWED_HOST_SUFFIXES escape hatch', () => {
    it('rejects a non-Snowflake host when the env var is unset', () => {
      assert.throws(() => validateAccessUrl('https://wiremock.local'));
    });

    it('accepts a non-Snowflake host explicitly added via the env var', () => {
      stubAllowlistEnv('wiremock.local');
      assert.doesNotThrow(() => validateAccessUrl('https://wiremock.local'));
    });

    it('does not accept unrelated hosts just because the env var is set', () => {
      stubAllowlistEnv('wiremock.local');
      assert.throws(() => validateAccessUrl('https://attacker.example'));
    });
  });
});
