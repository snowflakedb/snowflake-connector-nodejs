import assert from 'assert';
import { normalizeConnectionOptions } from '../../../lib/connection/normalize_connection_options';

describe('normalizeConnectionOptions', function () {
  it('resolves all key aliases', function () {
    assert.deepStrictEqual(
      normalizeConnectionOptions({
        account: 'testaccount',
        user: 'alice',
        private_key_file: '/key.p8',
      }),
      { account: 'testaccount', username: 'alice', privateKeyPath: '/key.p8' },
    );
  });

  it('applies snake_case-to-camelCase overrides for acronyms', function () {
    assert.deepStrictEqual(
      normalizeConnectionOptions({
        account: 'testaccount',
        client_request_mfa_token: true,
        force_gcp_use_downscoped_credential: true,
        disable_saml_url_check: true,
        crl_allow_certificates_without_crl_url: true,
      }),
      {
        account: 'testaccount',
        clientRequestMFAToken: true,
        forceGCPUseDownscopedCredential: true,
        disableSamlURLCheck: true,
        crlAllowCertificatesWithoutCrlURL: true,
      },
    );
  });

  it('strips undefined values', function () {
    assert.deepStrictEqual(
      normalizeConnectionOptions({
        account: 'testaccount',
        role: undefined,
        warehouse: undefined,
      }),
      { account: 'testaccount' },
    );
  });

  it('prefers camelCase value when both camelCase and snake_case are provided', function () {
    assert.deepStrictEqual(
      normalizeConnectionOptions({
        account: 'testaccount',
        privateKeyPath: '/camel',
        private_key_path: '/snake',
      }),
      { account: 'testaccount', privateKeyPath: '/camel' },
    );
  });

  it('handles single-word and multi-word keys', function () {
    assert.deepStrictEqual(
      normalizeConnectionOptions({
        account: 'testaccount',
        warehouse: 'wh',
        database: 'db',
        schema: 'sc',
        role: 'rl',
        private_key_pass: 'snakepass',
        oauth_client_id: 'myid',
        client_session_keep_alive: true,
        workload_identity_provider: 'AWS',
      }),
      {
        account: 'testaccount',
        warehouse: 'wh',
        database: 'db',
        schema: 'sc',
        role: 'rl',
        privateKeyPass: 'snakepass',
        oauthClientId: 'myid',
        clientSessionKeepAlive: true,
        workloadIdentityProvider: 'AWS',
      },
    );
  });
});
