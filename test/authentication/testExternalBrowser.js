const assert = require('assert');
const connParameters = require('./connectionParameters');
const AuthTest = require('./authTestsBaseClass.js');
const authUtil = require('../../lib/authentication/authentication_util');
const AuthenticationTypes = require('../../lib/authentication/authentication_types');

describe('External browser authentication tests', function () {
  const provideBrowserCredentialsPath = '/externalbrowser/provideBrowserCredentials.js';
  const login = connParameters.snowflakeTestBrowserUser;
  const password = connParameters.snowflakeAuthTestOktaPass;
  let authTest;

  beforeEach(async () => {
    authTest = new AuthTest();
    await authTest.cleanBrowserProcesses();
  });

  afterEach(async () => {
    await authTest.destroyConnection();
  });

  describe('External browser tests', async () => {
    it('Successful connection', async () => {
      const connectionOption = {
        ...connParameters.externalBrowser,
        clientStoreTemporaryCredential: false,
      };
      authTest.createConnection(connectionOption);
      const provideCredentialsPromise = authTest.execWithTimeout(
        'node',
        [provideBrowserCredentialsPath, 'success', login, password],
        15000,
      );
      await authTest.connectAndProvideCredentials(provideCredentialsPromise);
      authTest.verifyNoErrorWasThrown();
      await authTest.verifyConnectionIsUp();
    });

    it('Mismatched Username', async () => {
      const connectionOption = {
        ...connParameters.externalBrowser,
        username: 'differentUsername',
        clientStoreTemporaryCredential: false,
      };
      authTest.createConnection(connectionOption);
      const provideCredentialsPromise = authTest.execWithTimeout(
        'node',
        [provideBrowserCredentialsPath, 'success', login, password],
        15000,
      );
      await authTest.connectAndProvideCredentials(provideCredentialsPromise);
      authTest.verifyErrorWasThrown(
        'The user you were trying to authenticate as differs from the user currently logged in at the IDP.',
      );
      await authTest.verifyConnectionIsNotUp(
        'Unable to perform operation using terminated connection.',
      );
    });

    it('Wrong credentials', async () => {
      const login = 'itsnotanaccount.com';
      const password = 'fakepassword';
      const connectionOption = {
        ...connParameters.externalBrowser,
        browserActionTimeout: 10000,
        clientStoreTemporaryCredential: false,
      };
      authTest.createConnection(connectionOption);
      const provideCredentialsPromise = authTest.execWithTimeout('node', [
        provideBrowserCredentialsPath,
        'fail',
        login,
        password,
      ]);
      await authTest.connectAndProvideCredentials(provideCredentialsPromise);
      authTest.verifyErrorWasThrown(
        'Error while getting SAML token: Browser action timed out after 10000 ms.',
      );
      await authTest.verifyConnectionIsNotUp();
    });

    it('External browser timeout', async () => {
      const connectionOption = {
        ...connParameters.externalBrowser,
        browserActionTimeout: 100,
        clientStoreTemporaryCredential: false,
      };
      authTest.createConnection(connectionOption);
      const connectToBrowserPromise = authTest.execWithTimeout('node', [
        provideBrowserCredentialsPath,
        'timeout',
      ]);
      await authTest.connectAndProvideCredentials(connectToBrowserPromise);
      authTest.verifyErrorWasThrown(
        'Error while getting SAML token: Browser action timed out after 100 ms.',
      );
      await authTest.verifyConnectionIsNotUp();
    });
  });

  describe('External browser tests with connect()', async () => {
    it('Successful connection', async () => {
      const connectionOption = {
        ...connParameters.externalBrowser,
        clientStoreTemporaryCredential: false,
        allowExternalBrowserSyncConnect: true,
      };
      authTest.createConnection(connectionOption);
      const provideCredentialsPromise = authTest.execWithTimeout(
        'node',
        [provideBrowserCredentialsPath, 'success', login, password],
        15000,
      );
      await authTest.connectAndProvideCredentialsWithConnect(provideCredentialsPromise);
      authTest.verifyNoErrorWasThrown();
      await authTest.verifyConnectionIsUp();
    });

    it('Mismatched Username', async () => {
      const connectionOption = {
        ...connParameters.externalBrowser,
        username: 'differentUsername',
        clientStoreTemporaryCredential: false,
        allowExternalBrowserSyncConnect: true,
      };
      authTest.createConnection(connectionOption);
      const provideCredentialsPromise = authTest.execWithTimeout(
        'node',
        [provideBrowserCredentialsPath, 'success', login, password],
        15000,
      );
      await authTest.connectAndProvideCredentialsWithConnect(provideCredentialsPromise);
      authTest.verifyErrorWasThrown(
        'The user you were trying to authenticate as differs from the user currently logged in at the IDP.',
      );
      await authTest.verifyConnectionIsNotUp(
        'Unable to perform operation using terminated connection.',
      );
    });

    it('Wrong credentials', async () => {
      const login = 'itsnotanaccount.com';
      const password = 'fakepassword';
      const connectionOption = {
        ...connParameters.externalBrowser,
        browserActionTimeout: 10000,
        clientStoreTemporaryCredential: false,
        allowExternalBrowserSyncConnect: true,
      };
      authTest.createConnection(connectionOption);
      const provideCredentialsPromise = authTest.execWithTimeout('node', [
        provideBrowserCredentialsPath,
        'fail',
        login,
        password,
      ]);
      await authTest.connectAndProvideCredentialsWithConnect(provideCredentialsPromise);
      authTest.verifyErrorWasThrown(
        'Error while getting SAML token: Browser action timed out after 10000 ms.',
      );
      await authTest.verifyConnectionIsNotUp();
    });

    it('External browser timeout', async () => {
      const connectionOption = {
        ...connParameters.externalBrowser,
        browserActionTimeout: 100,
        clientStoreTemporaryCredential: false,
        allowExternalBrowserSyncConnect: true,
      };
      authTest.createConnection(connectionOption);
      const connectToBrowserPromise = authTest.execWithTimeout('node', [
        provideBrowserCredentialsPath,
        'timeout',
      ]);
      await authTest.connectAndProvideCredentialsWithConnect(connectToBrowserPromise);
      authTest.verifyErrorWasThrown(
        'Error while getting SAML token: Browser action timed out after 100 ms.',
      );
      await authTest.verifyConnectionIsNotUp();
    });
  });

  describe('ID Token authentication tests', async () => {
    const connectionOption = {
      ...connParameters.externalBrowser,
      clientStoreTemporaryCredential: true,
    };
    const idTokenKey = authUtil.buildOauthAccessTokenCacheKey(
      connectionOption.host,
      connectionOption.username,
      AuthenticationTypes.ID_TOKEN_AUTHENTICATOR,
    );

    let firstIdToken;

    before(async () => {
      await authUtil.removeFromCache(idTokenKey);
    });

    after(async () => {
      await authUtil.removeFromCache(idTokenKey);
    });

    it('obtains the id token from the server and saves it on the local storage', async function () {
      authTest.createConnection(connectionOption);
      const provideCredentialsPromise = authTest.execWithTimeout(
        'node',
        [provideBrowserCredentialsPath, 'success', login, password],
        15000,
      );
      await authTest.connectAndProvideCredentials(provideCredentialsPromise);
      authTest.verifyNoErrorWasThrown();
      await authTest.verifyConnectionIsUp();
    });

    it('the token is saved in the credential manager', async function () {
      firstIdToken = await authUtil.removeFromCache(idTokenKey);
      assert.notStrictEqual(firstIdToken, null);
    });

    it('authenticates by token, browser credentials not needed', async function () {
      authTest.createConnection(connectionOption);
      await authTest.connectAsync();
      authTest.verifyNoErrorWasThrown();
      await authTest.verifyConnectionIsUp();
    });

    it('opens browser again when token is incorrect', async function () {
      await authUtil.removeFromCache(idTokenKey);
      authTest.createConnection(connectionOption);
      const provideCredentialsPromise = authTest.execWithTimeout(
        'node',
        [provideBrowserCredentialsPath, 'success', login, password],
        15000,
      );
      await authTest.connectAndProvideCredentials(provideCredentialsPromise);
      authTest.verifyNoErrorWasThrown();
      await authTest.verifyConnectionIsUp();
    });

    it('refreshes the token for credential cache key', async function () {
      const newToken = await authUtil.readCache(idTokenKey);
      assert.notStrictEqual(firstIdToken, newToken);
    });
  });
});
