const snowflake = require('../../lib/snowflake');
const assert = require('assert');
const testUtil = require('../integration/testUtil');
const connParameters = require('./connectionParameters');
const { exec, spawn } = require('child_process');
const Util = require('../../lib/util');
const JsonCredentialManager = require('../../lib/authentication/secure_storage/json_credential_manager');

describe('External browser authentication tests', function () {
  const provideBrowserCredentialsPath = '/externalbrowser/provideBrowserCredentials.js';
  const login = connParameters.snowflakeTestBrowserUser;
  const password = connParameters.snowflakeAuthTestOktaPass;
  let connection, error;

  before(async () => {
    await cleanBrowserProcesses();
  });

  afterEach(async () => {
    await cleanBrowserProcesses();
    await destroyConnection(connection);
    error = undefined;
  });

  describe('External browser tests', async () => {
    it('Successful connection', async () => {
      const connectionOption = { ...connParameters.externalBrowser, clientStoreTemporaryCredential: false };
      connection = await snowflake.createConnection(connectionOption);
      const provideCredentialsPromise = execWithTimeout('node', [provideBrowserCredentialsPath, 'success', login, password], 15000);
      await Promise.allSettled([connection.connectAsync(connectAsyncCallback()), provideCredentialsPromise]);
      verifyNoErrorWasThrown();
      await verifyConnectionIsUp(connection);
    });

    it('Mismatched Username', async () => {
      const connectionOption = { ...connParameters.externalBrowser, username: 'differentUsername', clientStoreTemporaryCredential: false };
      connection = await snowflake.createConnection(connectionOption);
      const provideCredentialsPromise = execWithTimeout('node', [provideBrowserCredentialsPath, 'success', login, password], 15000);
      await Promise.allSettled([connection.connectAsync(connectAsyncCallback()), provideCredentialsPromise]);
      assert.strictEqual(error?.message, 'The user you were trying to authenticate as differs from the user currently logged in at the IDP.');
      await verifyConnectionIsNotUp(connection, 'Unable to perform operation using terminated connection.');
    });

    it('Wrong credentials', async () => {
      const login = 'itsnotanaccount.com';
      const password = 'fakepassword';
      const connectionOption = { ...connParameters.externalBrowser, browserActionTimeout: 10000, clientStoreTemporaryCredential: false };
      connection = await snowflake.createConnection(connectionOption);

      const provideCredentialsPromise = execWithTimeout('node', [provideBrowserCredentialsPath, 'fail', login, password]);
      await Promise.allSettled([connection.connectAsync(connectAsyncCallback()), provideCredentialsPromise]);
      assert.strictEqual(error?.message, 'Error while getting SAML token: Browser action timed out after 10000 ms.');
      await verifyConnectionIsNotUp(connection);
    });

    it('External browser timeout', async () => {
      const connectionOption = { ...connParameters.externalBrowser, browserActionTimeout: 100, clientStoreTemporaryCredential: false };
      connection = await snowflake.createConnection(connectionOption);

      const connectToBrowserPromise = execWithTimeout('node', [provideBrowserCredentialsPath, 'timeout']);
      await Promise.allSettled([connection.connectAsync(connectAsyncCallback()), connectToBrowserPromise]);
      assert.strictEqual(error?.message, 'Error while getting SAML token: Browser action timed out after 100 ms.');
      await verifyConnectionIsNotUp(connection);
    });
  });

  describe('ID Token authentication tests', async () => {
    const connectionOption = { ...connParameters.externalBrowser, clientStoreTemporaryCredential: true };
    const key = Util.buildCredentialCacheKey(connectionOption.host, connectionOption.username, 'ID_TOKEN');
    const defaultCredentialManager = new JsonCredentialManager();
    let firstIdToken;

    before(async () => {
      await defaultCredentialManager.remove(key);
      await cleanBrowserProcesses();
    });

    afterEach(async () => {
      await cleanBrowserProcesses();
      await destroyConnection(connection);
    });

    it('obtains the id token from the server and saves it on the local storage', async function () {
      connection = snowflake.createConnection(connectionOption);
      const provideCredentialsPromise = execWithTimeout('node', [provideBrowserCredentialsPath, 'success', login, password], 15000);
      await Promise.allSettled([connection.connectAsync(connectAsyncCallback()), provideCredentialsPromise]);
      verifyNoErrorWasThrown();
      await verifyConnectionIsUp(connection);
    });

    it('the token is saved in the credential manager', async function () {
      firstIdToken = await defaultCredentialManager.read(key);
      assert.notStrictEqual(firstIdToken, null);
    });

    it('authenticates by token, browser credentials not needed',  async function () {
      connection = snowflake.createConnection(connectionOption);
      await connection.connectAsync(connectAsyncCallback());
      verifyNoErrorWasThrown();
      await verifyConnectionIsUp(connection);
    });

    it('opens browser okta authentication again when token is incorrect',  async function () {
      await defaultCredentialManager.write(key, '1234');
      connection = snowflake.createConnection(connectionOption);
      const provideCredentialsPromise = execWithTimeout('node', [provideBrowserCredentialsPath, 'success', login, password], 15000);
      await Promise.allSettled([connection.connectAsync(connectAsyncCallback()), provideCredentialsPromise]);
      verifyNoErrorWasThrown();
      await verifyConnectionIsUp(connection);
    });

    it('refreshes the token for credential cache key', async function () {
      const newToken = await defaultCredentialManager.read(key);
      assert.notStrictEqual(firstIdToken, newToken);
    });
  });

  function connectAsyncCallback() {
    return function (err) {
      error = err;
    };
  }

  function verifyNoErrorWasThrown() {
    assert.equal(error, null);
  }
});

async function cleanBrowserProcesses() {
  exec('pkill -f chromium');
  exec('pkill -f xdg-open');
}

async function verifyConnectionIsUp(connection) {
  assert.ok(await connection.isValidAsync(), 'Connection is not valid');
  await testUtil.executeCmdAsync(connection, 'Select 1');
}

async function verifyConnectionIsNotUp(connection, message = 'Unable to perform operation because a connection was never established.') {
  assert.ok(!(connection.isUp()), 'Connection should not be up');
  try {
    await testUtil.executeCmdAsync(connection, 'Select 1');
    assert.fail('Expected error was not thrown');
  } catch (error) {
    assert.strictEqual(error.message, message);
  }
}

async function destroyConnection(connection) {
  if (connection !== undefined && connection.isUp()) {
    await testUtil.destroyConnectionAsync(connection);
  }
}

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
        reject(new Error(`Provide browser credentials process exited with code: ${code}, error: ${stderr}`));
      } else {
        resolve({ stdout, stderr });
      }
    });

    setTimeout(() => {
      child.kill();
      reject(new Error('Provide browser credentials process timed out'));
    }, timeout);
  });
}
