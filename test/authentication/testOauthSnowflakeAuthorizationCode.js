const assert = require('assert');
const connParameters = require('./connectionParameters');
const AuthTest = require('./authTestsBaseClass.js');
const authUtil = require('../../lib/authentication/authentication_util');
const AuthenticationTypes = require('../../lib/authentication/authentication_types');

describe('Oauth Snowflake Authorization code tests', function () {
  const provideBrowserCredentialsPath = '/externalbrowser/provideBrowserCredentials.js';
  const login = connParameters.snowflakeAuthTestOauthOktaClientId;
  const password = connParameters.snowflakeAuthTestOauthOktaPassword;
  let authTest;

  beforeEach(async () => {
    authTest = new AuthTest();
    await authTest.cleanBrowserProcesses();
  });

  afterEach(async () => {
    await authTest.destroyConnection();
  });

  describe('Oauth Snowflake Authorization code tests', async () => {
    it('Successful connection', async () => {
      const connectionOption = { ...connParameters.oauthSnowflakeAuthorizationCode, clientStoreTemporaryCredential: false };
      authTest.createConnection(connectionOption);
      const provideCredentialsPromise = authTest.execWithTimeout('node', [provideBrowserCredentialsPath, 'internalOauthSnowflakeSuccess', login, password], 15000);
      await authTest.connectAndProvideCredentials(provideCredentialsPromise);
      authTest.verifyNoErrorWasThrown();
      await authTest.verifyConnectionIsUp();
    });

    it('Mismatched Username', async () => {
      const connectionOption = { ...connParameters.oauthSnowflakeAuthorizationCode, username: 'differentUsername', clientStoreTemporaryCredential: false };
      authTest.createConnection(connectionOption);
      const provideCredentialsPromise = authTest.execWithTimeout('node', [provideBrowserCredentialsPath, 'internalOauthSnowflakeSuccess', login, password], 15000);
      await authTest.connectAndProvideCredentials(provideCredentialsPromise);
      authTest.verifyErrorWasThrown('The user you were trying to authenticate as differs from the user tied to the access token.');
      await authTest.verifyConnectionIsNotUp('Unable to perform operation using terminated connection.');
    });

    it('External browser timeout', async () => {
      const connectionOption = { ...connParameters.oauthSnowflakeAuthorizationCode, browserActionTimeout: 100, clientStoreTemporaryCredential: false };
      authTest.createConnection(connectionOption);
      const connectToBrowserPromise = authTest.execWithTimeout('node', [provideBrowserCredentialsPath, 'timeout']);
      await authTest.connectAndProvideCredentials(connectToBrowserPromise);
      authTest.verifyErrorWasThrown('Browser action timed out after 100 ms.');
      await authTest.verifyConnectionIsNotUp();
    });
  });

  describe('Oauth Snowflake Authorization - token cache', async () => {
    const connectionOption = { ...connParameters.oauthSnowflakeAuthorizationCode, clientStoreTemporaryCredential: true };
    const accessTokenKey = authUtil.buildOauthAccessTokenCacheKey(connectionOption.host,
      connectionOption.username, AuthenticationTypes.OAUTH_AUTHORIZATION_CODE);
    const refreshTokenKey = authUtil.buildOauthRefreshTokenCacheKey(connectionOption.host,
      connectionOption.username, AuthenticationTypes.OAUTH_AUTHORIZATION_CODE);
    let firstIdToken;

    before(async () => {
      await authUtil.removeFromCache(accessTokenKey);
      await authUtil.removeFromCache(refreshTokenKey);
    });

    after(async () => {
      await authUtil.removeFromCache(accessTokenKey);
      await authUtil.removeFromCache(refreshTokenKey);
    });

    it('obtains the id token from the server and saves it on the local storage', async function () {
      authTest.createConnection(connectionOption);
      const provideCredentialsPromise = authTest.execWithTimeout('node', [provideBrowserCredentialsPath, 'internalOauthSnowflakeSuccess', login, password], 15000);
      await authTest.connectAndProvideCredentials(provideCredentialsPromise);
      authTest.verifyNoErrorWasThrown();
      await authTest.verifyConnectionIsUp();
    });

    it('the token is saved in the credential manager', async function () {
      firstIdToken = await authUtil.readCache(accessTokenKey);
      assert.notStrictEqual(firstIdToken, null);
    });

    it('authenticates by token, browser credentials not needed',  async function () {
      authTest.createConnection(connectionOption);
      await authTest.connectAsync();
      authTest.verifyNoErrorWasThrown();
      await authTest.verifyConnectionIsUp();
    });

    it('opens browser again when token is incorrect',  async function () {
      await authUtil.removeFromCache(accessTokenKey);
      authTest.createConnection(connectionOption);
      const provideCredentialsPromise = authTest.execWithTimeout('node', [provideBrowserCredentialsPath, 'internalOauthSnowflakeSuccess', login, password], 15000);
      await authTest.connectAndProvideCredentials(provideCredentialsPromise);
      authTest.verifyNoErrorWasThrown();
      await authTest.verifyConnectionIsUp();
    });

    it('refreshes the token for credential cache key', async function () {
      const newToken = await authUtil.removeFromCache(accessTokenKey);
      assert.notStrictEqual(firstIdToken, newToken);
    });
  });
});

