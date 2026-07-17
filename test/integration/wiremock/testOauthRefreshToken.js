const connParameters = require('../../authentication/connectionParameters');
const AuthTest = require('../../authentication/authTestsBaseClass');
const { runWireMockAsync, addWireMockMappingsFromFile } = require('../../wiremockRunner');
const { getFreePort } = require('../../../lib/util');
const GlobalConfig = require('../../../lib/global_config');
const authUtil = require('../../../lib/authentication/authentication_util');
const { get } = require('axios');
const { buildCacheKey, CacheTokenTypes } = require('../../../lib/authentication/cache_key_builder');
const {
  JsonCredentialManager,
} = require('../../../lib/authentication/secure_storage/json_credential_manager');
const assert = require('node:assert');

function simulateBrowserRedirect(urlString) {
  const redirectUri = new URL(urlString);
  const url = `${redirectUri.searchParams.get('redirect_uri')}?code=9s6wFkGDOjmgNEdwJMlDzv1AwxDjDVBxiT6wVqXjG5s&state=${redirectUri.searchParams.get('state')}`;
  return authUtil.withBrowserActionTimeout(3000, get(url));
}

describe('Oauth Refresh token for Autorization Code', function () {
  let accessTokenKey, refreshTokenKey, connectionOptionAuthorizationCode, authTest, port, wireMock;

  before(async () => {
    const defaultCredentialManager = new JsonCredentialManager();
    port = await getFreePort();
    wireMock = await runWireMockAsync(port);
    GlobalConfig.setCustomCredentialManager(defaultCredentialManager);
    connectionOptionAuthorizationCode = {
      ...connParameters.oauthAuthorizationCodeOnWiremock,
      port: port,
      oauthAuthorizationUrl: `https://127.0.0.1:${port}/oauth/authorize`,
      oauthTokenRequestUrl: `http://127.0.0.1:${port}/oauth/token-request`,
      clientStoreTemporaryCredential: true,
    };
    accessTokenKey = buildCacheKey({
      tokenType: CacheTokenTypes.OAUTH_ACCESS_TOKEN,
      idp: connectionOptionAuthorizationCode.oauthTokenRequestUrl,
      snowflake: connectionOptionAuthorizationCode.host,
      username: connectionOptionAuthorizationCode.username,
      role: connectionOptionAuthorizationCode.role || '',
    });
    refreshTokenKey = buildCacheKey({
      tokenType: CacheTokenTypes.OAUTH_REFRESH_TOKEN,
      idp: connectionOptionAuthorizationCode.oauthTokenRequestUrl,
      snowflake: connectionOptionAuthorizationCode.host,
      username: connectionOptionAuthorizationCode.username,
      role: connectionOptionAuthorizationCode.role || '',
    });
  });
  beforeEach(async () => {
    authTest = new AuthTest();
    await wireMock.scenarios.resetAllScenarios();
    await wireMock.mappings.resetAllMappings();
    await authUtil.removeFromCache(accessTokenKey);
    await authUtil.removeFromCache(refreshTokenKey);
  });
  afterEach(async () => {
    await wireMock.scenarios.resetAllScenarios();
    await wireMock.mappings.resetAllMappings();
    await authUtil.removeFromCache(accessTokenKey);
    await authUtil.removeFromCache(refreshTokenKey);
  });

  it('Successful flow scenario with authentication when token expired - AuthorizationCode', async function () {
    await addWireMockMappingsFromFile(
      wireMock,
      'wiremock/mappings/oauth/token_cache_and_refresh/caching_refreshed_access_token_and_new_refresh_token.json',
    );
    await authUtil.writeToCache(accessTokenKey, 'expired_token');

    await authTest.createConnection({
      ...connectionOptionAuthorizationCode,
      openExternalBrowserCallback: simulateBrowserRedirect,
    });
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
  });

  it('Save oauth tokens after idp authorization', async function () {
    await addWireMockMappingsFromFile(
      wireMock,
      'wiremock/mappings/oauth/token_cache_and_refresh/caching_tokens_after_connecting.json',
    );
    await authTest.createConnection({
      ...connectionOptionAuthorizationCode,
      openExternalBrowserCallback: simulateBrowserRedirect,
    });
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

  it('Keeps refresh token in cache when IDP does not return a new one', async function () {
    await authUtil.writeToCache(refreshTokenKey, 'cached_refresh_token');
    await addWireMockMappingsFromFile(
      wireMock,
      'wiremock/mappings/oauth/token_cache_and_refresh/refresh_token_kept_when_not_returned.json',
    );
    await authTest.createConnection(connectionOptionAuthorizationCode);
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
    const accessTokenInCache = await authUtil.readCache(accessTokenKey);
    const refreshTokenInCache = await authUtil.readCache(refreshTokenKey);
    assert.strictEqual(accessTokenInCache, 'new_access_token');
    assert.strictEqual(refreshTokenInCache, 'cached_refresh_token');
  });

  it('Reauthenticates with refreshed token when cached access token is expired', async function () {
    await authUtil.writeToCache(accessTokenKey, 'expired_token');
    await authUtil.writeToCache(refreshTokenKey, 'cached_refresh_token');
    await addWireMockMappingsFromFile(
      wireMock,
      'wiremock/mappings/oauth/token_cache_and_refresh/reauthenticate_with_refreshed_token.json',
    );
    await authTest.createConnection(connectionOptionAuthorizationCode);
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
    const accessTokenInCache = await authUtil.readCache(accessTokenKey);
    const refreshTokenInCache = await authUtil.readCache(refreshTokenKey);
    assert.strictEqual(accessTokenInCache, 'new_access_token');
    assert.strictEqual(refreshTokenInCache, 'new_refresh_token');
  });

  it('Reauthenticates with refresh token when cached access token returns success=false from the server', async function () {
    await authUtil.writeToCache(accessTokenKey, 'invalid_token');
    await authUtil.writeToCache(refreshTokenKey, 'cached_refresh_token');
    await addWireMockMappingsFromFile(
      wireMock,
      'wiremock/mappings/oauth/token_cache_and_refresh/reauthenticate_on_invalid_oauth_token.json',
    );
    await authTest.createConnection(connectionOptionAuthorizationCode);
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
    const accessTokenInCache = await authUtil.readCache(accessTokenKey);
    const refreshTokenInCache = await authUtil.readCache(refreshTokenKey);
    assert.strictEqual(accessTokenInCache, 'new_access_token');
    assert.strictEqual(refreshTokenInCache, 'new_refresh_token');
  });

  it('Surfaces error but clears access token cache on success=false with a non-oauth failure code', async function () {
    await authUtil.writeToCache(accessTokenKey, 'invalid_token');
    await authUtil.writeToCache(refreshTokenKey, 'cached_refresh_token');
    await addWireMockMappingsFromFile(
      wireMock,
      'wiremock/mappings/oauth/token_cache_and_refresh/surfaces_error_on_non_oauth_failure_code.json',
    );
    await authTest.createConnection(connectionOptionAuthorizationCode);
    await authTest.connectAsync();
    authTest.verifyErrorWasThrown('Authentication failed.');
    const accessTokenInCache = await authUtil.readCache(accessTokenKey);
    const refreshTokenInCache = await authUtil.readCache(refreshTokenKey);
    assert.strictEqual(accessTokenInCache, null);
    assert.strictEqual(refreshTokenInCache, 'cached_refresh_token');
  });

  it('Restart authentication when error during refreshing token', async function () {
    await authUtil.writeToCache(accessTokenKey, 'expired_token');
    await authUtil.writeToCache(refreshTokenKey, 'first_refresh_token');
    await addWireMockMappingsFromFile(
      wireMock,
      'wiremock/mappings/oauth/token_cache_and_refresh/restarting_full_flow_on_refresh_token_error.json',
    );
    await authTest.createConnection({
      ...connectionOptionAuthorizationCode,
      openExternalBrowserCallback: simulateBrowserRedirect,
    });
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
    const accessTokenInCache = await authUtil.readCache(accessTokenKey);
    const refreshTokenInCache = await authUtil.readCache(refreshTokenKey);
    assert.strictEqual(accessTokenInCache, 'new-refreshed-access-token-123');
    assert.strictEqual(refreshTokenInCache, 'new-refresh-token-123');
  });

  it('Restarts full flow on cold connect when only an invalid refresh token is cached', async function () {
    await authUtil.writeToCache(refreshTokenKey, 'invalid_refresh_token');
    await addWireMockMappingsFromFile(
      wireMock,
      'wiremock/mappings/oauth/token_cache_and_refresh/restarting_full_flow_on_cold_connect_refresh_token_error.json',
    );
    await addWireMockMappingsFromFile(wireMock, 'wiremock/mappings/login_request_ok.json');
    await authTest.createConnection({
      ...connectionOptionAuthorizationCode,
      openExternalBrowserCallback: simulateBrowserRedirect,
    });
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
