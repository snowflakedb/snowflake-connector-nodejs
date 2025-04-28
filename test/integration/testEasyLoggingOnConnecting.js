const snowflake = require('./../../lib/snowflake');
const connOption = require('./connectionOptions');
const Logger = require('./../../lib/logger');
const { reset: resetEasyLoggingModule } = require('../../lib/logger/easy_logging_starter');
const path = require('path');
const os = require('os');
const fsPromises = require('fs/promises');
const assert = require('assert');
const { codes } = require('./../../lib/errors');
const errorMessages = require('./../../lib/constants/error_messages');
const { configureLogger } = require('../configureLogger');
let tempDir = null;

describe('Easy logging tests', function () {

  before(async function () {
    tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'easy_logging_connect_tests_'));
  });

  after(async function () {
    configureLogger();
    await fsPromises.rm(tempDir, { recursive: true, force: true, maxRetries: 3 });
  });

  afterEach(function () {
    resetEasyLoggingModule();
  });

  it('Should apply easy logging config when connection is being opened with callback', function (done) {
    const logLevel = 'INFO';
    createConfigFile(logLevel).then((configFilePath) => {
      const configParameters = createConfigParameters(configFilePath);
      const connection = snowflake.createConnection(configParameters);
      connection.connect((err) => {
        if (err) {
          done(err);
        } else {
          Logger.getInstance().info('Logging something');
          assert.strictEqual(Logger.getInstance().getLevelTag(), logLevel);
          assert.strictEqual(Logger.getInstance().getTransportLabels().toString(), ['File'].toString());
          done();
        }
      });
    });
  });

  it('Should fail for connecting with wrong easy logging config', function (done) {
    const logLevel = 'something weird';
    createConfigFile(logLevel).then((configFilePath) => {
      const configParameters = createConfigParameters(configFilePath);
      const connection = snowflake.createConnection(configParameters);
      connection.connect((err) => {
        if (err) {
          try {
            assert.strictEqual(err.message, errorMessages[codes.ERR_CONN_CONNECT_INVALID_CLIENT_CONFIG]);
            assert.strictEqual(err.code, codes.ERR_CONN_CONNECT_INVALID_CLIENT_CONFIG);
            done();
          } catch (e) {
            done(e);
          }
        } else {
          done(new Error('Error should be thrown'));
        }
      });
    });
  });

  it('Should apply easy logging config when connection is being opened asynchronously', async function (){
    // given
    const logLevel = 'ERROR';
    const configFilePath = await createConfigFile(logLevel);
    const configParameters = createConfigParameters(configFilePath);
    const connection = snowflake.createConnection(configParameters);

    // when
    await connection.connectAsync();

    // then
    assert.strictEqual(Logger.getInstance().getLevelTag(), logLevel);
  });

  it('Should fail to connect asynchronously with wrong easy logging config', async function (){
    // given
    const logLevel = 'something weird';
    const configFilePath = await createConfigFile(logLevel);
    const configParameters = createConfigParameters(configFilePath);
    const connection = snowflake.createConnection(configParameters);

    // expect
    await assert.rejects(
      async () => await connection.connectAsync(),
      (err) => {
        assert.strictEqual(err.message, errorMessages[codes.ERR_CONN_CONNECT_INVALID_CLIENT_CONFIG]);
        assert.strictEqual(err.code, codes.ERR_CONN_CONNECT_INVALID_CLIENT_CONFIG);
        return true;
      }
    );
  });

  function createConfigParameters(clientConfigFile) {
    const config = {};
    Object.assign(config, connOption.valid);
    config.clientConfigFile = clientConfigFile;
    return config;
  }

  async function createConfigFile(logLevel) {
    const configFilePath = path.join(tempDir, 'config.json');
    const configContent = `{
              "common": {
                  "log_level": "${logLevel}",
                  "log_path": "${tempDir.replace(/\\/g, '\\\\')}"
              } 
          }`;
    await writeFile(configFilePath, configContent);
    return configFilePath;
  }

  async function writeFile(filePath, fileContent) {
    await fsPromises.writeFile(filePath, fileContent, { encoding: 'utf8', mode: 0o755 });
  }
});
