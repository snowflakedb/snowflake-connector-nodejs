const connParameters = require('../../authentication/connectionParameters');
const AuthTest = require('../../authentication/authTestsBaseClass');
const { runWireMockAsync, addWireMockMappingsFromFile } = require('../../wiremockRunner');
const { getFreePort } = require('../../../lib/util');
const GlobalConfig = require('../../../lib/global_config');
const authUtil = require('../../../lib/authentication/authentication_util');
const { get } = require('axios');
const AuthenticationTypes = require('../../../lib/authentication/authentication_types');
const {
  JsonCredentialManager,
} = require('../../../lib/authentication/secure_storage/json_credential_manager');
const assert = require('node:assert');

//refresh token
describe('Oauth - refreshing token', function () {
  describe('Authorization Code', function () {
    let accessTokenKey,
      refreshTokenKey,
      connectionOptionAuthorizationCode,
      authTest,
      port,
      wireMock;
    before(async () => {
      const defaultCredentialManager = new JsonCredentialManager();
      port = await getFreePort();
      wireMock = await runWireMockAsync(port);
      GlobalConfig.setCustomCredentialManager(defaultCredentialManager);
      connectionOptionAuthorizationCode = {
        ...connParameters.oauthAuthorizationCodeOnWiremock,
        ...{
          port: port,
          oauthAuthorizationUrl: `https://127.0.0.1:${port}/oauth/authorize`,
          oauthTokenRequestUrl: `http://127.0.0.1:${port}/oauth/token-request`,
          clientStoreTemporaryCredential: true,
        },
      };
      accessTokenKey = authUtil.buildOauthAccessTokenCacheKey(
        new URL(connectionOptionAuthorizationCode.oauthAuthorizationUrl).host,
        connectionOptionAuthorizationCode.username,
        AuthenticationTypes.OAUTH_AUTHORIZATION_CODE,
      );
      refreshTokenKey = authUtil.buildOauthRefreshTokenCacheKey(
        new URL(connectionOptionAuthorizationCode.oauthTokenRequestUrl).host,
        connectionOptionAuthorizationCode.username,
        AuthenticationTypes.OAUTH_AUTHORIZATION_CODE,
      );
    });
    beforeEach(async () => {
      authTest = new AuthTest();
      wireMock.scenarios.resetAllScenarios();
      wireMock.mappings.resetAllMappings();
      await authUtil.removeFromCache(accessTokenKey);
      await authUtil.removeFromCache(refreshTokenKey);
    });
    afterEach(async () => {
      wireMock.scenarios.resetAllScenarios();
      wireMock.mappings.resetAllMappings();
      await authUtil.removeFromCache(accessTokenKey);
      await authUtil.removeFromCache(refreshTokenKey);
    });

    it('Successful flow scenario with authentication when token expired - AuthorizationCode', async function () {
      GlobalConfig.setCustomRedirectingClient((redirectUri) => {
        const url = `${redirectUri.searchParams.get('redirect_uri')}?code=9s6wFkGDOjmgNEdwJMlDzv1AwxDjDVBxiT6wVqXjG5s&state=${redirectUri.searchParams.get('state')}`;
        return authUtil.withBrowserActionTimeout(3000, get(url));
      });

      await addWireMockMappingsFromFile(
        wireMock,
        'wiremock/mappings/oauth/token_cache_and_refresh/caching_refreshed_access_token_and_new_refresh_token.json',
      );
      await authUtil.writeToCache(accessTokenKey, 'expired_token');

      await authTest.createConnection(connectionOptionAuthorizationCode);
      await authTest.connectAsync();
      authTest.verifyNoErrorWasThrown();
    });

    it('Save oauth tokens after idp authorization', async function () {
      await addWireMockMappingsFromFile(
        wireMock,
        'wiremock/mappings/oauth/token_cache_and_refresh/caching_tokens_after_connecting.json',
      );
      GlobalConfig.setCustomRedirectingClient((redirectUri) => {
        const url = `${redirectUri.searchParams.get('redirect_uri')}?code=9s6wFkGDOjmgNEdwJMlDzv1AwxDjDVBxiT6wVqXjG5s&state=${redirectUri.searchParams.get('state')}`;
        return authUtil.withBrowserActionTimeout(3000, get(url));
      });
      await authTest.createConnection(connectionOptionAuthorizationCode);
      await authTest.connectAsync();
      authTest.verifyNoErrorWasThrown();
      const accessTokenInCache = await authUtil.readCache(accessTokenKey);
      const refreshTokenInCache = await authUtil.readCache(refreshTokenKey);
      assert.strictEqual(accessTokenInCache, 'new-refreshed-access-token-123');
      assert.strictEqual(refreshTokenInCache, 'new-refresh-token-123');
    });

    it('Use refresh token to get new access token', async function () {
      await authUtil.writeToCache(refreshTokenKey, 'first_refresh_token');
      await addWireMockMappingsFromFile(
        wireMock,
        'wiremock/mappings/oauth/token_cache_and_refresh/refreshing_expired_access_token.json',
      );
      await authTest.createConnection(connectionOptionAuthorizationCode);
      await authTest.connectAsync();
      authTest.verifyNoErrorWasThrown();
      const accessTokenInCache = await authUtil.readCache(accessTokenKey);
      const refreshTokenInCache = await authUtil.readCache(refreshTokenKey);
      assert.strictEqual(accessTokenInCache, 'new-refreshed-access-token-123');
      assert.strictEqual(refreshTokenInCache, 'new-refresh-token-123');
    });

    it('Restart authentication when error during refreshing token', async function () {
      GlobalConfig.setCustomRedirectingClient((redirectUri) => {
        const url = `${redirectUri.searchParams.get('redirect_uri')}?code=9s6wFkGDOjmgNEdwJMlDzv1AwxDjDVBxiT6wVqXjG5s&state=${redirectUri.searchParams.get('state')}`;
        return authUtil.withBrowserActionTimeout(3000, get(url));
      });
      await authUtil.writeToCache(accessTokenKey, 'expired_token');
      await authUtil.writeToCache(refreshTokenKey, 'first_refresh_token');
      await addWireMockMappingsFromFile(
        wireMock,
        'wiremock/mappings/oauth/token_cache_and_refresh/restarting_full_flow_on_refresh_token_error.json',
      );
      await authTest.createConnection(connectionOptionAuthorizationCode);
      await authTest.connectAsync();
      authTest.verifyNoErrorWasThrown();
      const accessTokenInCache = await authUtil.readCache(accessTokenKey);
      const refreshTokenInCache = await authUtil.readCache(refreshTokenKey);
      assert.strictEqual(accessTokenInCache, 'new-refreshed-access-token-123');
      assert.strictEqual(refreshTokenInCache, 'new-refresh-token-123');
    });

    it('Using cached token for successful authentication ', async function () {
      await authUtil.writeToCache(accessTokenKey, 'reused-access-token-123');
      await addWireMockMappingsFromFile(
        wireMock,
        'wiremock/mappings/oauth/token_cache_and_refresh/reusing_cached_access_token_to_authenticate.json',
      );
      authTest.createConnection(connectionOptionAuthorizationCode);
      await authTest.connectAsync();
      authTest.verifyNoErrorWasThrown();
    });
  });
  describe('Client Credentials', function () {
    let accessTokenKey,
      refreshTokenKey,
      connectionOptionAClientCredentials,
      authTest,
      port,
      wireMock;
    before(async () => {
      const defaultCredentialManager = new JsonCredentialManager();
      port = await getFreePort();
      wireMock = await runWireMockAsync(port);
      GlobalConfig.setCustomCredentialManager(defaultCredentialManager);
      connectionOptionAClientCredentials = {
        ...connParameters.oauthClientCredentialsOnWiremock,
        ...{
          port: port,
          oauthAuthorizationUrl: `https://127.0.0.1:${port}/oauth/authorize`,
          oauthTokenRequestUrl: `http://127.0.0.1:${port}/oauth/token-request`,
          clientStoreTemporaryCredential: true,
        },
      };
      accessTokenKey = authUtil.buildOauthAccessTokenCacheKey(
        new URL(connectionOptionAClientCredentials.oauthAuthorizationUrl).host,
        connectionOptionAClientCredentials.username,
        AuthenticationTypes.OAUTH_CLIENT_CREDENTIALS,
      );
      refreshTokenKey = authUtil.buildOauthRefreshTokenCacheKey(
        new URL(connectionOptionAClientCredentials.oauthTokenRequestUrl).host,
        connectionOptionAClientCredentials.username,
        AuthenticationTypes.OAUTH_CLIENT_CREDENTIALS,
      );
    });
    beforeEach(async () => {
      authTest = new AuthTest();
      wireMock.scenarios.resetAllScenarios();
      wireMock.mappings.resetAllMappings();
      await authUtil.removeFromCache(accessTokenKey);
      await authUtil.removeFromCache(refreshTokenKey);
    });
    afterEach(async () => {
      wireMock.scenarios.resetAllScenarios();
      wireMock.mappings.resetAllMappings();
      await authUtil.removeFromCache(accessTokenKey);
      await authUtil.removeFromCache(refreshTokenKey);
    });

    it('Successful flow scenario with authentication when token expired', async function () {
      GlobalConfig.setCustomRedirectingClient((redirectUri) => {
        const url = `${redirectUri.searchParams.get('redirect_uri')}?code=9s6wFkGDOjmgNEdwJMlDzv1AwxDjDVBxiT6wVqXjG5s&state=${redirectUri.searchParams.get('state')}`;
        return authUtil.withBrowserActionTimeout(3000, get(url));
      });

      await addWireMockMappingsFromFile(
        wireMock,
        'wiremock/mappings/oauth/token_cache_and_refresh/refreshing_expired_access_token_client_credentials.json',
      );
      await authUtil.writeToCache(accessTokenKey, 'expired_token');

      await authTest.createConnection(connectionOptionAClientCredentials);
      await authTest.connectAsync();
      authTest.verifyNoErrorWasThrown();
    });
  });
});
