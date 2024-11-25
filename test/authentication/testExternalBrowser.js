const snowflake = require('../../lib/snowflake');
const assert = require('assert');
const testUtil = require('../integration/testUtil');
const connParameters = require('./connectionParameters');
const { exec, spawn } = require('child_process');

describe('External browser authentication tests', function () {
  const provideBrowserCredentialsPath = '/externalbrowser/provideBrowserCredentials.js';
  const login = connParameters.snowflakeTestBrowserUser;
  const password = connParameters.snowflakeAuthTestOktaPass;
  let connection;

  describe('External browser tests', async () => {
    before(async () => {
      await cleanBrowserProcesses();
    });

    afterEach(async () => {
      await cleanBrowserProcesses();
      if (connection !== undefined && connection.isUp()) {
        await testUtil.destroyConnectionAsync(connection);
      }
    });

    it('Successful connection', async () => {
      const connectionOption = { ...connParameters.externalBrowser, clientStoreTemporaryCredential: false };
      connection = await snowflake.createConnection(connectionOption);
      const provideCredentialsPromise = execWithTimeout('node', [provideBrowserCredentialsPath, 'success', login, password], 15000);
      await Promise.allSettled([connection.connectAsync(function () {}), provideCredentialsPromise]);
      await verifyConnectionIsUp(connection);
    });

    it('Wrong credentials', async () => {
      const login = 'itsnotanaccount.com';
      const password = 'fakepassword';
      const connectionOption = { ...connParameters.externalBrowser, browserActionTimeout: 5000, clientStoreTemporaryCredential: false };
      connection = await snowflake.createConnection(connectionOption);

      const provideCredentialsPromise = execWithTimeout('node', [provideBrowserCredentialsPath, 'fail', login, password]);
      await Promise.allSettled([connection.connectAsync(function () {}), provideCredentialsPromise]);
      await verifyConnectionIsNotUp(connection);
    });

    it('External browser timeout', async () => {
      const connectionOption = { ...connParameters.externalBrowser, browserActionTimeout: 100, clientStoreTemporaryCredential: false };
      connection = await snowflake.createConnection(connectionOption);

      const connectToBrowserPromise = execWithTimeout('node', [provideBrowserCredentialsPath, 'timeout']);
      await Promise.allSettled([connection.connectAsync(function () {}), connectToBrowserPromise]);
      await verifyConnectionIsNotUp(connection);
    });
  });
});

async function cleanBrowserProcesses() {
  exec('pkill -f chromium');
  exec('pkill -f xdg-open');
}

async function verifyConnectionIsUp(connection) {
  assert.ok(await connection.isValidAsync());
  await testUtil.executeCmdAsync(connection, 'Select 1');
}

async function verifyConnectionIsNotUp(connection) {
  try {
    assert(!(await connection.isValidAsync()));
    await testUtil.executeCmdAsync(connection, 'Select 1');
    assert.fail('Expected error was not thrown');
  } catch (error) {
    assert.strictEqual(error.message, 'Unable to perform operation because a connection was never established.');
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
