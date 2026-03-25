const assert = require('assert');
const connParameters = require('../../authentication/connectionParameters');
const AuthTest = require('../../authentication/authTestsBaseClass');
const { runWireMockAsync, addWireMockMappingsFromFile } = require('../../wiremockRunner');
const { getFreePort } = require('../../../lib/util');
const authUtil = require('../../../lib/authentication/authentication_util');
const GlobalConfig = require('../../../lib/global_config');
const { get } = require('axios');
const {
  JsonCredentialManager,
} = require('../../../lib/authentication/secure_storage/json_credential_manager');
const net = require('net');

function simulateBrowserRedirect(urlString) {
  const redirectUri = new URL(urlString);
  const url = `${redirectUri.searchParams.get('redirect_uri')}?code=9s6wFkGDOjmgNEdwJMlDzv1AwxDjDVBxiT6wVqXjG5s&state=${redirectUri.searchParams.get('state')}`;
  return authUtil.withBrowserActionTimeout(3000, get(url));
}

describe('Oauth Authorization Code authentication', function () {
  let port, authTest, wireMock, connectionOption;

  before(async () => {
    const defaultCredentialManager = new JsonCredentialManager();
    port = await getFreePort();
    wireMock = await runWireMockAsync(port);
    GlobalConfig.setCustomCredentialManager(defaultCredentialManager);
    connectionOption = {
      ...connParameters.oauthAuthorizationCodeOnWiremock,
      port: port,
      oauthAuthorizationUrl: `https://127.0.0.1:${port}/oauth/authorize`,
      oauthTokenRequestUrl: `http://127.0.0.1:${port}/oauth/token-request`,
    };
  });

  beforeEach(async () => {
    authTest = new AuthTest();
  });

  afterEach(async () => {
    await wireMock.scenarios.resetAllScenarios();
    await wireMock.mappings.resetAllMappings();
  });

  after(async () => {
    await wireMock.global.shutdown();
  });

  // TODO:
  // The tests could be greatly simplified during UD migration:
  // - short test names because we repeat context from describe
  // - move common logic to a helper functions
  // - reuse wiremock for query_ok and heartbeat_ok
  // - use template variables in wiremocks
  // - hit wiremock mapping /oauth/authorize instead of current simulateBrowserRedirect
  it('Successful flow scenario Authorization Code flow', async function () {
    await addWireMockMappingsFromFile(
      wireMock,
      'wiremock/mappings/oauth/authorization_code/successful_flow.json',
    );
    authTest.createConnection({
      ...connectionOption,
      openExternalBrowserCallback: simulateBrowserRedirect,
    });
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
    await authTest.verifyConnectionIsUp();
  });

  it('successfully connects with empty scope', async function () {
    let authorizationUrlUsed;
    await addWireMockMappingsFromFile(
      wireMock,
      'wiremock/mappings/oauth/authorization_code/successful_flow.json',
    );
    authTest.createConnection({
      ...connectionOption,
      role: undefined,
      oauthScope: undefined,
      openExternalBrowserCallback: (urlString) => {
        authorizationUrlUsed = new URL(urlString);
        return simulateBrowserRedirect(urlString);
      },
    });
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
    assert.strictEqual(
      authorizationUrlUsed.searchParams.has('scope'),
      false,
      'scope query parameter should not be present',
    );
    await authTest.verifyConnectionIsUp();
  });

  it('Successful flow scenario Authorization Code flow - error', async function () {
    await addWireMockMappingsFromFile(
      wireMock,
      'wiremock/mappings/oauth/authorization_code/successful_flow.json',
    );
    authTest.createConnection({
      ...connectionOption,
      openExternalBrowserCallback: (urlString) => {
        const redirectUri = new URL(urlString);
        const url = `${redirectUri.searchParams.get('redirect_uri')}?error=invalid_scope&error_description=One+or+more+scopes+are+not+configured+for+the+authorization+server+resource.`;
        return authUtil.withBrowserActionTimeout(3000, get(url));
      },
    });
    await authTest.connectAsync();
    authTest.verifyErrorWasThrown(
      'Error while getting oauth authorization code. ErrorCode invalid_scope. Message: One or more scopes are not configured for the authorization server resource.',
    );
    await authTest.verifyConnectionIsNotUp();
  });

  it('Authorization Code flow - invalid state', async function () {
    await addWireMockMappingsFromFile(
      wireMock,
      'wiremock/mappings/oauth/authorization_code/successful_flow.json',
    );
    authTest.createConnection({
      ...connectionOption,
      openExternalBrowserCallback: (urlString) => {
        const redirectUri = new URL(urlString);
        const url = `${redirectUri.searchParams.get('redirect_uri')}?code=9s6wFkGDOjmgNEdwJMlDzv1AwxDjDVBxiT6wVqXjG5s&state=invalidState}`;
        return authUtil.withBrowserActionTimeout(3000, get(url));
      },
    });
    await authTest.connectAsync();
    authTest.verifyErrorWasThrown('unexpected "state" response parameter value');
  });

  it('Successful flow scenario Authorization Code flow - invalid code', async function () {
    await addWireMockMappingsFromFile(
      wireMock,
      'wiremock/mappings/oauth/authorization_code/token_request_error.json',
    );
    authTest.createConnection({
      ...connectionOption,
      openExternalBrowserCallback: (urlString) => {
        const redirectUri = new URL(urlString);
        const url = `${redirectUri.searchParams.get('redirect_uri')}?code=invalidCode&state=${redirectUri.searchParams.get('state')}`;
        return authUtil.withBrowserActionTimeout(3000, get(url));
      },
    });
    await authTest.connectAsync();
    authTest.verifyErrorWasThrown('Request failed with status code 400');
  });

  it('Successful flow scenario Authorization Code flow - no token', async function () {
    await addWireMockMappingsFromFile(
      wireMock,
      'wiremock/mappings/oauth/authorization_code/token_request_error.json',
    );
    authTest.createConnection({
      ...connectionOption,
      openExternalBrowserCallback: (urlString) => {
        const redirectUri = new URL(urlString);
        const url = `${redirectUri.searchParams.get('redirect_uri')}?code=invalidCode&state=${redirectUri.searchParams.get('state')}`;
        return authUtil.withBrowserActionTimeout(3000, get(url));
      },
    });
    await authTest.connectAsync();
    authTest.verifyErrorWasThrown('Request failed with status code 400');
  });

  it('Successful flow scenario with single use refresh token - no token', async function () {
    await addWireMockMappingsFromFile(
      wireMock,
      'wiremock/mappings/oauth/authorization_code/successful_flow_with_single_use_refresh_tokens.json',
    );
    authTest.createConnection({
      ...connectionOption,
      oauthEnableSingleUseRefreshTokens: true,
      openExternalBrowserCallback: (urlString) => {
        const redirectUri = new URL(urlString);
        const url = `${redirectUri.searchParams.get('redirect_uri')}?code=123&state=${redirectUri.searchParams.get('state')}`;
        return authUtil.withBrowserActionTimeout(3000, get(url));
      },
    });
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
  });

  it('Should not open browser when the port is unavailable', async function () {
    const PORT = 8011;

    const server = net.createServer((socket) => {
      socket.destroy();
    });

    server.listen(PORT, () => {});
    try {
      const connOption = {
        ...connParameters.oauthAuthorizationCodeOnWiremock,
        oauthRedirectUri: `http://localhost:${PORT}/snowflake/oauth-redirect`,
        openExternalBrowserCallback: () => {
          throw Error('Browser should not be open');
        },
      };
      await authTest.createConnection(connOption);
      await authTest.connectAsync();
      authTest.verifyErrorWasThrown(
        'Cannot run server using provided redirect url. Port not available.',
      );
    } finally {
      server.close();
    }
  });
});
