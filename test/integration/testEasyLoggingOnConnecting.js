/*
 * Copyright (c) 2023 Snowflake Computing Inc. All rights reserved.
 */
const snowflake = require('./../../lib/snowflake');
const connOption = require('./connectionOptions');
const Logger = require('./../../lib/logger');
const {reset: resetEasyLoggingModule} = require('../../lib/logger/easy_logging_starter');
const path = require('path');
const os = require('os');
const fsPromises = require('fs/promises');
const assert = require('assert');
const logLevelBefore = Logger.getInstance().getLevel();
const {codes} = require('./../../lib/errors');
const errorMessages = require('./../../lib/constants/error_messages');
let tempDir = null;

describe('Easy logging tests', function () {

  before(async function () {
    tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'easy_logging_connect_tests_'));
  });

  after(async function () {
    Logger.getInstance().configure({
      level: logLevelBefore,
      filePath: 'snowflake.log'
    });
    await fsPromises.rm(tempDir, { recursive: true, force: true });
  });

  afterEach(function () {
    resetEasyLoggingModule();
  });

  xit('Should apply easy logging config when connection is being opened with callback', function (done) {
    const logLevel = 'ERROR';
    createConfigFile(logLevel).then((configFilePath) => {
      const configParameters = createConfigParameters(configFilePath);
      const connection = snowflake.createConnection(configParameters);
      connection.connect((err) => {
        if (err) {
          done(err);
        } else {
          assert.strictEqual(Logger.getInstance().getLevelTag(), logLevel);
          done();
        }
      });
    });
  });

  xit('Should fail for connecting with wrong easy logging config', function (done) {
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

  xit('Should apply easy logging config when connection is being opened asynchronously', async function (){
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

  xit('Should fail to connect asynchronously with wrong easy logging config', async function (){
    // given
    const logLevel = 'something weird';
    const configFilePath = await createConfigFile(logLevel);
    const configParameters = createConfigParameters(configFilePath);
    const connection = snowflake.createConnection(configParameters);

    // expect
    await connection.connectAsync(err => {
      if (err) {
        assert.strictEqual(err.message, errorMessages[codes.ERR_CONN_CONNECT_INVALID_CLIENT_CONFIG]);
        assert.strictEqual(err.code, codes.ERR_CONN_CONNECT_INVALID_CLIENT_CONFIG);
      } else {
        assert.fail('Error should be thrown');
      }
    });
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

  async function writeFile (filePath, fileContent) {
    await fsPromises.writeFile(filePath, fileContent, { encoding: 'utf8' });
  }
});
