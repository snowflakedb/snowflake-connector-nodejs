import assert from 'assert';
import { normalizeConnectionOptions } from '../../../lib/connection/normalize_connection_options';
import { WIP_ConnectionOptions } from '../../../lib/connection/types';

describe('normalizeConnectionOptions', function () {
  const testCases: {
    name: string;
    input: Record<string, unknown>;
    expected: WIP_ConnectionOptions;
  }[] = [
    {
      name: 'converts snake_case keys to camelCase',
      input: { account: 'testaccount', private_key_path: '/path/to/key.p8' },
      expected: { account: 'testaccount', privateKeyPath: '/path/to/key.p8' },
    },
    {
      name: 'maps user alias to username',
      input: { account: 'testaccount', user: 'alice' },
      expected: { account: 'testaccount', username: 'alice' },
    },
    {
      name: 'maps private_key_file alias to privateKeyPath',
      input: { account: 'testaccount', private_key_file: '/key.p8' },
      expected: { account: 'testaccount', privateKeyPath: '/key.p8' },
    },
    {
      name: 'converts OAuth snake_case keys',
      input: {
        account: 'testaccount',
        authenticator: 'OAUTH_CLIENT_CREDENTIALS',
        oauth_client_id: 'myid',
        oauth_client_secret: 'mysecret',
        oauth_token_request_url: 'https://snowflake.com/oauth/token-request',
      },
      expected: {
        account: 'testaccount',
        authenticator: 'OAUTH_CLIENT_CREDENTIALS',
        oauthClientId: 'myid',
        oauthClientSecret: 'mysecret',
        oauthTokenRequestUrl: 'https://snowflake.com/oauth/token-request',
      },
    },
    {
      name: 'handles mixed camelCase and snake_case',
      input: {
        account: 'testaccount',
        privateKeyPath: '/camel/key.p8',
        private_key_pass: 'snakepass',
      },
      expected: {
        account: 'testaccount',
        privateKeyPath: '/camel/key.p8',
        privateKeyPass: 'snakepass',
      },
    },
    {
      name: 'prefers camelCase when both forms provided',
      input: {
        account: 'testaccount',
        privateKeyPath: '/camel',
        private_key_path: '/snake',
      },
      expected: {
        account: 'testaccount',
        privateKeyPath: '/camel',
      },
    },
    {
      name: 'strips undefined values',
      input: {
        account: 'testaccount',
        role: undefined,
        warehouse: undefined,
      },
      expected: {
        account: 'testaccount',
      },
    },
    {
      name: 'converts acronym override keys',
      input: {
        account: 'testaccount',
        client_request_mfa_token: true,
        force_gcp_use_downscoped_credential: true,
        disable_saml_url_check: true,
        crl_allow_certificates_without_crl_url: true,
      },
      expected: {
        account: 'testaccount',
        clientRequestMFAToken: true,
        forceGCPUseDownscopedCredential: true,
        disableSamlURLCheck: true,
        crlAllowCertificatesWithoutCrlURL: true,
      },
    },
    {
      name: 'converts workload_identity keys',
      input: {
        account: 'testaccount',
        authenticator: 'WORKLOAD_IDENTITY',
        workload_identity_provider: 'AWS',
      },
      expected: {
        account: 'testaccount',
        authenticator: 'WORKLOAD_IDENTITY',
        workloadIdentityProvider: 'AWS',
      },
    },
    {
      name: 'passes through single-word keys unchanged',
      input: {
        account: 'testaccount',
        warehouse: 'wh',
        database: 'db',
        schema: 'sc',
        role: 'rl',
      },
      expected: {
        account: 'testaccount',
        warehouse: 'wh',
        database: 'db',
        schema: 'sc',
        role: 'rl',
      },
    },
    {
      name: 'converts known snake_case keys without warnings',
      input: {
        account: 'testaccount',
        validate_default_parameters: true,
        private_key_path: '/key.p8',
        client_session_keep_alive: true,
      },
      expected: {
        account: 'testaccount',
        validateDefaultParameters: true,
        privateKeyPath: '/key.p8',
        clientSessionKeepAlive: true,
      },
    },
  ];
  testCases.forEach(({ name, input, expected }) => {
    it(name, function () {
      assert.deepStrictEqual(normalizeConnectionOptions(input), expected);
    });
  });
});
