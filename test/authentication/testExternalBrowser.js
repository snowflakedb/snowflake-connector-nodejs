const snowflake = require('../../lib/snowflake');
const assert = require('assert');
const testUtil = require('../integration/testUtil');
const connParameters = require('./connectionParameters');
const { exec, spawn } = require('child_process');

describe('External browser authentication tests', function () {
  const provideBrowserCredentialsPath = '/externalbrowser/provideBrowserCredentials.js';
  const login = connParameters.snowflakeTestBrowserUser;
  const password = connParameters.snowflakeAuthTestOktaPass;


  describe('External browser tests', async () => {
    before(async () => {
      await cleanBrowserProcesses();
    });

    afterEach(async () => {
      await cleanBrowserProcesses();
    });

    it('Successful connection', async () => {
      const connectionOption = { ...connParameters.externalBrowser, clientStoreTemporaryCredential: false };
      const connection = await snowflake.createConnection(connectionOption);
      const connectAsyncPromise = connection.connectAsync(function (err, connection) {
        connectionHandler(err, connection);
      });
      const provideCredentialsPromise = execWithTimeout('node', [provideBrowserCredentialsPath, 'success', login, password], 15000);
      await Promise.all([connectAsyncPromise, provideCredentialsPromise]);
    });

    it('Wrong credentials', async () => {
      const login = 'itsnotanaccount.com';
      const password = 'fakepassword';
      const connectionOption = { ...connParameters.externalBrowser, clientStoreTemporaryCredential: false };
      const connection = await snowflake.createConnection(connectionOption);

      connection.connectAsync(function (err, connection) {
        connectionHandler(err, connection);
      });
      const provideCredentialsPromise = execWithTimeout('node', [provideBrowserCredentialsPath, 'fail', login, password]);
      await Promise.all([provideCredentialsPromise]);

    });

    it('External browser timeout', async () => {
      const connectionOption = { ...connParameters.externalBrowser, browserActionTimeout: 100, clientStoreTemporaryCredential: false };
      const connection = await snowflake.createConnection(connectionOption);

      const connectAsyncPromise = connection.connectAsync(function (err, connection) {
        timeoutConnectionHandler(err, connection);
      });

      const connectToBrowserPromise = execWithTimeout('node', [provideBrowserCredentialsPath, 'timeout']);
      await Promise.all([connectAsyncPromise, connectToBrowserPromise]);
    });
  });
});

async function timeoutConnectionHandler(err, timeout) {
  try {
    assert.ok(err, `Browser action timed out after ${timeout} ms.`);
  } catch (err){
    await assert.fail(err);
  }
}

async function cleanBrowserProcesses() {
  exec('pkill -f chromium');
  exec('pkill -f xdg-open');
}

function connectionHandler(err, connection) {
  assert.ok(connection.isUp(), 'Connection is not active');
  testUtil.destroyConnection(connection, function () {
    try {
      assert.ok(!connection.isUp(), 'Connection is not closed');
    } catch (err) {
      assert.fail(err);
    }
  });
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
