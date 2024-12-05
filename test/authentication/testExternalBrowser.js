const assert = require('assert');
const connParameters = require('./connectionParameters');
const { spawn } = require('child_process');
const Util = require('../../lib/util');
const JsonCredentialManager = require('../../lib/authentication/secure_storage/json_credential_manager');
const AuthTest = require('./authTestsBaseClass.js');

describe('External browser authentication tests', function () {
  const runAuthTestsManually = process.env.RUN_AUTH_TESTS_MANUALLY === 'true';
  const cleanBrowserProcessesPath = '/externalbrowser/cleanBrowserProcesses.js';
  const provideBrowserCredentialsPath = '/externalbrowser/provideBrowserCredentials.js';
  const login = connParameters.snowflakeTestBrowserUser;
  const password = connParameters.snowflakeAuthTestOktaPass;
  let authTest;

  beforeEach(async () => {
    authTest = new AuthTest();
    await cleanBrowserProcesses();
  });

  afterEach(async () => {
    await authTest.destroyConnection();
  });

  describe('External browser tests', async () => {
    it('Successful connection', async () => {
      const connectionOption = { ...connParameters.externalBrowser, clientStoreTemporaryCredential: false };
      authTest.createConnection(connectionOption);
      const provideCredentialsPromise = execWithTimeout('node', [provideBrowserCredentialsPath, 'success', login, password], 15000);
      await connectAndProvideCredentials(provideCredentialsPromise);
      authTest.verifyNoErrorWasThrown();
      await authTest.verifyConnectionIsUp();
    });

    it('Mismatched Username', async () => {
      const connectionOption = { ...connParameters.externalBrowser, username: 'differentUsername', clientStoreTemporaryCredential: false };
      authTest.createConnection(connectionOption);
      const provideCredentialsPromise = execWithTimeout('node', [provideBrowserCredentialsPath, 'success', login, password], 15000);
      await connectAndProvideCredentials(provideCredentialsPromise);
      authTest.verifyErrorWasThrown('The user you were trying to authenticate as differs from the user currently logged in at the IDP.');
      await authTest.verifyConnectionIsNotUp('Unable to perform operation using terminated connection.');
    });

    it('Wrong credentials', async () => {
      const login = 'itsnotanaccount.com';
      const password = 'fakepassword';
      const connectionOption = { ...connParameters.externalBrowser, browserActionTimeout: 10000, clientStoreTemporaryCredential: false };
      authTest.createConnection(connectionOption);
      const provideCredentialsPromise = execWithTimeout('node', [provideBrowserCredentialsPath, 'fail', login, password]);
      await connectAndProvideCredentials(provideCredentialsPromise);
      authTest.verifyErrorWasThrown('Error while getting SAML token: Browser action timed out after 10000 ms.');
      await authTest.verifyConnectionIsNotUp();
    });

    it('External browser timeout', async () => {
      const connectionOption = { ...connParameters.externalBrowser, browserActionTimeout: 100, clientStoreTemporaryCredential: false };
      authTest.createConnection(connectionOption);
      const connectToBrowserPromise = execWithTimeout('node', [provideBrowserCredentialsPath, 'timeout']);
      await connectAndProvideCredentials(connectToBrowserPromise);
      authTest.verifyErrorWasThrown('Error while getting SAML token: Browser action timed out after 100 ms.');
      await authTest.verifyConnectionIsNotUp();
    });
  });

  describe('ID Token authentication tests', async () => {
    const connectionOption = { ...connParameters.externalBrowser, clientStoreTemporaryCredential: true };
    const key = Util.buildCredentialCacheKey(connectionOption.host, connectionOption.username, 'ID_TOKEN');
    const defaultCredentialManager = new JsonCredentialManager();
    let firstIdToken;

    before(async () => {
      await defaultCredentialManager.remove(key);
    });

    it('obtains the id token from the server and saves it on the local storage', async function () {
      authTest.createConnection(connectionOption);
      const provideCredentialsPromise = execWithTimeout('node', [provideBrowserCredentialsPath, 'success', login, password], 15000);
      await connectAndProvideCredentials(provideCredentialsPromise);
      authTest.verifyNoErrorWasThrown();
      await authTest.verifyConnectionIsUp();
    });

    it('the token is saved in the credential manager', async function () {
      firstIdToken = await defaultCredentialManager.read(key);
      assert.notStrictEqual(firstIdToken, null);
    });

    it('authenticates by token, browser credentials not needed',  async function () {
      authTest.createConnection(connectionOption);
      await authTest.connectAsync();
      authTest.verifyNoErrorWasThrown();
      await authTest.verifyConnectionIsUp();
    });

    it('opens browser okta authentication again when token is incorrect',  async function () {
      await defaultCredentialManager.write(key, '1234');
      authTest.createConnection(connectionOption);
      const provideCredentialsPromise = execWithTimeout('node', [provideBrowserCredentialsPath, 'success', login, password], 15000);
      await connectAndProvideCredentials(provideCredentialsPromise);
      authTest.verifyNoErrorWasThrown();
      await authTest.verifyConnectionIsUp();
    });

    it('refreshes the token for credential cache key', async function () {
      const newToken = await defaultCredentialManager.read(key);
      assert.notStrictEqual(firstIdToken, newToken);
    });
  });

  async function cleanBrowserProcesses() {
    if (!runAuthTestsManually) {
      await execWithTimeout('node', [cleanBrowserProcessesPath], 15000);
    }
  }

  async function connectAndProvideCredentials(provideCredentialsPromise) {
    if (runAuthTestsManually) {
      await authTest.connectAsync();
    } else {
      await Promise.allSettled([authTest.connectAsync(), provideCredentialsPromise]);
    }
  }
});

function execWithTimeout(command, args, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { shell: true });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data;
    });

    child.stderr.on('data', (data) => {
      stderr += data;
    });

    child.on('error', (err) => {
      reject(err);
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Process exited with code: ${code}, error: ${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });

    setTimeout(() => {
      child.kill();
      reject(new Error('Process timed out'));
    }, timeout);
  });
}
