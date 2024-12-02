const AuthTest = require('./authTestsBaseClass');
const connParameters = require('./connectionParameters');
const snowflake = require('../../lib/snowflake');
const path = require('path');
const assert = require('node:assert');
const fs = require('fs').promises;


describe('Key-pair authentication', function () {
  let authTest;

  beforeEach(async () => {
    authTest = new AuthTest();
  });

  afterEach(async () => {
    await authTest.destroyConnection();
  });

  describe('Private key', function () {
    it('Successful connection', async function () {
      const privateKey = await getFileContent(connParameters.snowflakeAuthTestPrivateKeyPath);
      const connectionOption = { ... connParameters.keypairPrivateKey, privateKey: privateKey };
      authTest.createConnection(connectionOption);
      await authTest.connectAsync();
      authTest.verifyNoErrorWasThrown();
      await authTest.verifyConnectionIsUp();
    });

    it('Invalid private key format', async function () {
      const invalidPrivateKeyFormat = 'invalidKey';
      const connectionOption = { ... connParameters.keypairPrivateKey, privateKey: invalidPrivateKeyFormat };
      try {
        snowflake.createConnection(connectionOption);
        assert.fail('Expected error was not thrown');
      } catch (err) {
        assert.strictEqual(err.message, 'Invalid private key. The specified value must be a string in pem format of type pkcs8');
      }
    });

    it('Invalid private key', async function () {
      const privateKey = await getFileContent(connParameters.snowflakeAuthTestInvalidPrivateKeyPath);
      const connectionOption = { ... connParameters.keypairPrivateKey, privateKey: privateKey };
      authTest.createConnection(connectionOption);
      await authTest.connectAsync();
      assert.match(authTest.error?.message, /JWT token is invalid./);
      await authTest.verifyConnectionIsNotUp('Unable to perform operation using terminated connection.');
    });
  });

  describe('Private key path', function () {
    it('Successful connection', async function () {
      const connectionOption = connParameters.keypairPrivateKeyPath;
      authTest.createConnection(connectionOption);
      await authTest.connectAsync();
      authTest.verifyNoErrorWasThrown();
      await authTest.verifyConnectionIsUp();
    });

    it('Invalid private key', async function () {
      const connectionOption = { ...connParameters.keypairPrivateKeyPath, privateKeyPath: connParameters.snowflakeAuthTestInvalidPrivateKeyPath };
      authTest.createConnection(connectionOption);
      await authTest.connectAsync();
      assert.match(authTest.error?.message, /JWT token is invalid./);
      await authTest.verifyConnectionIsNotUp('Unable to perform operation using terminated connection.');
    });

    it('Successful connection using encrypted private key', async function () {
      const connectionOption = connParameters.keypairEncryptedPrivateKeyPath;
      authTest.createConnection(connectionOption);
      await authTest.connectAsync();
      authTest.verifyNoErrorWasThrown();
      await authTest.verifyConnectionIsUp();
    });

    it('Invalid private key password', async function () {
      const connectionOption = { ...connParameters.keypairEncryptedPrivateKeyPath, privateKeyPass: 'invalid' };
      authTest.createConnection(connectionOption);
      await authTest.connectAsync();
      assert.match(authTest.error?.message, /bad decrypt/);
      await authTest.verifyConnectionIsNotUp();
    });
  });
});

async function getFileContent(filePath) {
  try {
    const absolutePath = path.resolve(filePath);
    return await fs.readFile(absolutePath, 'utf8');
  } catch (err) {
    throw new Error(`Error reading file: ${err.message}`);
  }
}
