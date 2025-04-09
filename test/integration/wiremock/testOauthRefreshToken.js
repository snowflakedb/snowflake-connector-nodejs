const connParameters = require('../../authentication/connectionParameters');
const AuthTest = require('../../authentication/authTestsBaseClass');
const { runWireMockAsync, addWireMockMappingsFromFile } = require('../../wiremockRunner');
const { getFreePort } = require('../../../lib/util');
const GlobalConfig = require('../../../lib/global_config');
const authUtil = require('../../../lib/authentication/authentication_util');
const { get } = require('axios');
const Util = require('../../../lib/util');
const AuthenticationTypes = require('../../../lib/authentication/authentication_types');
const { JsonCredentialManager } = require('../../../lib/authentication/secure_storage/json_credential_manager');
const assert = require('node:assert');

//refresh token
describe('Oauth - refreshing token', function () {
  let accessTokenKey, refreshTokenKey, connectionOption, authTest, port, wireMock;
  before(async () => {
    const defaultCredentialManager = new JsonCredentialManager();
    port = await getFreePort();
    wireMock = await runWireMockAsync(port);
    GlobalConfig.setCustomCredentialManager(defaultCredentialManager);
    connectionOption = {
      ...connParameters.oauthAuthorizationCodeOnWiremock,
      ...{
        port: port,
        oauthAuthorizationUrl: `https://127.0.0.1:${port}/oauth/authorize`,
        oauthTokenRequestUrl: `http://127.0.0.1:${port}/oauth/token-request`,
        clientStoreTemporaryCredential: true
      }
    };
    // TODO: extract enum of credentail types
    accessTokenKey = Util.buildCredentialCacheKey(connectionOption.host,
      connectionOption.username, AuthenticationTypes.OAUTH_AUTHORIZATION_CODE + 'access_token');
    refreshTokenKey = Util.buildCredentialCacheKey(connectionOption.host,
      connectionOption.username, AuthenticationTypes.OAUTH_AUTHORIZATION_CODE + 'refresh_token');
  });
  beforeEach(async () => {
    authTest = new AuthTest();
    await GlobalConfig.getCredentialManager().remove(accessTokenKey);
    await GlobalConfig.getCredentialManager().remove(refreshTokenKey);
  });

  it('Successful flow scenario with reauthentication when token expired', async function () {
    GlobalConfig.setCustomRedirectingClient((redirectUri) => {
      const url = `${redirectUri.searchParams.get('redirect_uri')}?code=9s6wFkGDOjmgNEdwJMlDzv1AwxDjDVBxiT6wVqXjG5s&state=${redirectUri.searchParams.get('state')}`;
      return authUtil.withBrowserActionTimeout(3000, get(url));
    });

    await addWireMockMappingsFromFile(wireMock, 'wiremock/mappings/oauth/token_cache_and_refresh/caching_refreshed_access_token_and_new_refresh_token.json');
    await GlobalConfig.getCredentialManager().write(accessTokenKey, 'expired_token');

    await authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
  });

  it('Save oauth tokens after idp authorization', async function () {
    await addWireMockMappingsFromFile(wireMock, 'wiremock/mappings/oauth/token_cache_and_refresh/caching_tokens_after_connecting.json');
    GlobalConfig.setCustomRedirectingClient((redirectUri) =>  {
      const url = `${redirectUri.searchParams.get('redirect_uri')}?code=9s6wFkGDOjmgNEdwJMlDzv1AwxDjDVBxiT6wVqXjG5s&state=${redirectUri.searchParams.get('state')}`;
      return authUtil.withBrowserActionTimeout(3000, get(url));
    }
    );
    await authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
    const accessTokenInCache = await GlobalConfig.getCredentialManager().read(accessTokenKey);
    const refreshTokenInCache = await GlobalConfig.getCredentialManager().read(refreshTokenKey);
    assert.strictEqual(accessTokenInCache, 'new-refreshed-access-token-123');
    assert.strictEqual(refreshTokenInCache, 'new-refresh-token-123');
  });


  it('Use refresh token to get new access token', async function () {
    await GlobalConfig.getCredentialManager().write(refreshTokenKey, 'first_refresh_token');
    await addWireMockMappingsFromFile(wireMock, 'wiremock/mappings/oauth/token_cache_and_refresh/refreshing_expired_access_token.json');
    await authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
    const accessTokenInCache = await GlobalConfig.getCredentialManager().read(accessTokenKey);
    const refreshTokenInCache = await GlobalConfig.getCredentialManager().read(refreshTokenKey);
    assert.strictEqual(accessTokenInCache, 'new-refreshed-access-token-123');
    assert.strictEqual(refreshTokenInCache, 'new-refresh-token-123');
  });

  it('Restart authentication when error during refreshing token', async function () {
    GlobalConfig.setCustomRedirectingClient((redirectUri) => {
      const  url = `${redirectUri.searchParams.get('redirect_uri')}?code=9s6wFkGDOjmgNEdwJMlDzv1AwxDjDVBxiT6wVqXjG5s&state=${redirectUri.searchParams.get('state')}`;
      return authUtil.withBrowserActionTimeout(3000, get(url));
    });
    await GlobalConfig.getCredentialManager().write(accessTokenKey, 'expired_token');
    await GlobalConfig.getCredentialManager().write(refreshTokenKey, 'first_refresh_token');
    await addWireMockMappingsFromFile(wireMock, 'wiremock/mappings/oauth/token_cache_and_refresh/restarting_full_flow_on_refresh_token_error.json');
    await authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
    const accessTokenInCache = await GlobalConfig.getCredentialManager().read(accessTokenKey);
    const refreshTokenInCache = await GlobalConfig.getCredentialManager().read(refreshTokenKey);
    assert.strictEqual(accessTokenInCache, 'new-refreshed-access-token-123');
    assert.strictEqual(refreshTokenInCache, 'new-refresh-token-123');
  });

  it('Using cached token for successful authentication ', async function () {
    await GlobalConfig.getCredentialManager().write(accessTokenKey, 'reused-access-token-123');
    await addWireMockMappingsFromFile(wireMock, 'wiremock/mappings/oauth/token_cache_and_refresh/reusing_cached_access_token_to_authenticate.json');
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
  });

});
