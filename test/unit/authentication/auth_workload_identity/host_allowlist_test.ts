import assert from 'assert';
import sinon from 'sinon';
import {
  SNOWFLAKE_WIF_ALLOWED_HOST_SUFFIXES_ENV_VAR,
  validateHost,
} from '../../../../lib/authentication/auth_workload_identity/host_allowlist';

describe('validateHost', () => {
  function stubAllowlistEnv(suffixes: string) {
    sinon.stub(process, 'env').value({
      ...process.env,
      [SNOWFLAKE_WIF_ALLOWED_HOST_SUFFIXES_ENV_VAR]: suffixes,
    });
  }

  afterEach(() => {
    sinon.restore();
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
    // FQDN form (trailing dot) combined with an explicit port. normalizeHost strips the port and
    // trailing dot, so this is still accepted.
    'acct.snowflakecomputing.com.:443',
  ];

  acceptedHosts.forEach((host) => {
    it(`accepts ${host}`, () => {
      assert.doesNotThrow(() => validateHost(host));
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
      assert.throws(() => validateHost(host));
    });
  });

  describe('SNOWFLAKE_WIF_ALLOWED_HOST_SUFFIXES escape hatch', () => {
    it('rejects a non-Snowflake host when the env var is unset', () => {
      assert.throws(() => validateHost('wiremock.local'));
    });

    it('accepts a non-Snowflake host explicitly added via the env var', () => {
      stubAllowlistEnv('wiremock.local');
      assert.doesNotThrow(() => validateHost('wiremock.local'));
    });

    it('does not accept unrelated hosts just because the env var is set', () => {
      stubAllowlistEnv('wiremock.local');
      assert.throws(() => validateHost('attacker.example'));
    });
  });
});
