/*
 * Copyright (c) 2023 Snowflake Computing Inc. All rights reserved.
 */
const { init, reset: resetEasyLoggingModule } = require('../../../lib/logger/easy_logging_starter');

const assert = require('assert');
const fsPromises = require('fs/promises');
const path = require('path');
const os = require('os');
const Logger = require('../../../lib/logger');
require('../../../lib/snowflake'); // import of it sets up node logger
const { exists } = require('../../../lib/util');
const defaultConfigName = 'sf_client_config.json';
const logLevelBefore = Logger.getInstance().getLevel();
let tempDir = null;

before(async function () {
  tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'easy_logging_starter_tests_'));
});

after(async function () {
  Logger.getInstance().configure({
    level: logLevelBefore,
    filePath: 'snowflake.log'
  });
  await fsPromises.rm(tempDir, { recursive: true, force: true });
});

afterEach(async function () {
  await fsPromises.rm(path.join(os.homedir(), defaultConfigName), { force: true });
  resetEasyLoggingModule();
});

describe('Easy logging starter tests', function () {

  it('should configure easy logging only once when initialized with config file path', async function () {
    // given
    const logLevel = 'ERROR';
    const configFilePath = await createConfigFile(logLevel, tempDir, 'config.json');
    const anotherConfigFilePath = await createConfigFile('WARN', tempDir, 'another_config.json');

    // when
    await init(configFilePath);

    // then
    assert.strictEqual(Logger.getInstance().getLevelTag(), logLevel);
    assert.strictEqual(Logger.getInstance().easyLoggingConfigureCounter, 1);

    // when
    await init(null);
    await init(configFilePath);
    await init(anotherConfigFilePath);

    // then
    assert.strictEqual(Logger.getInstance().getLevelTag(), logLevel);
    assert.strictEqual(Logger.getInstance().easyLoggingConfigureCounter, 1);
  });

  it('should configure easy logging only once when initialized without config file path', async function () {
    // given
    const logLevel = 'ERROR';
    await createConfigFile(logLevel, os.homedir(), defaultConfigName);

    // when
    await init(null);
    await init(null);

    // then
    assert.strictEqual(Logger.getInstance().getLevelTag(), logLevel);
    assert.strictEqual(Logger.getInstance().easyLoggingConfigureCounter, 1);
  });

  it('should reconfigure easy logging if config file path is not given for the first time', async function () {
    // given
    const homeDirLogLevel = 'ERROR';
    await createConfigFile(homeDirLogLevel, os.homedir(), defaultConfigName);
    const customLogLevel = 'DEBUG';
    const customConfigFilePath = await createConfigFile(customLogLevel, tempDir, 'config.json');

    // when
    await init(null);

    // then
    assert.strictEqual(Logger.getInstance().getLevelTag(), homeDirLogLevel);
    assert.strictEqual(Logger.getInstance().easyLoggingConfigureCounter, 1);

    // when
    await init(customConfigFilePath);

    // then
    assert.strictEqual(Logger.getInstance().getLevelTag(), customLogLevel);
    assert.strictEqual(Logger.getInstance().easyLoggingConfigureCounter, 2);
  });

  it('should fail for unknown log level', async function () {
    // given
    const logLevel = 'something weird';
    const configFilePath = await createConfigFile(logLevel, tempDir, defaultConfigName);

    // expect
    await assert.rejects(
      async () => await init(configFilePath),
      (err) => {
        assert.strictEqual(err.name, 'EasyLoggingError');
        assert.strictEqual(err.message, 'Failed to initialize easy logging');
        assert.match(err.cause.message, /Parsing client configuration failed/);
        return true;
      });
  });

  it('should fail for inaccessible log path', async function () {
    // given
    const logLevel = 'ERROR';
    const configFilePath = await createConfigFile(logLevel, tempDir, defaultConfigName, '/?inaccessible');

    // expect
    await assert.rejects(
      async () => await init(configFilePath),
      (err) => {
        assert.strictEqual(err.name, 'EasyLoggingError');
        assert.strictEqual(err.message, 'Failed to initialize easy logging');
        assert.match(err.cause.message, /no such file or directory|permission denied/);
        return true;
      });
  });

  async function createConfigFile(logLevel, configDirectory, configFileName, logPath) {
    const configFilePath = path.join(configDirectory, configFileName);
    const configContent = `{
              "common": {
                  "log_level": "${logLevel}",
                  "log_path": "${exists(logPath) ? logPath : tempDir.replace(/\\/g, '\\\\')}"
              } 
          }`;
    await writeFile(configFilePath, configContent);
    return configFilePath;
  }

  async function writeFile(filePath, fileContent) {
    await fsPromises.writeFile(filePath, fileContent, { encoding: 'utf8', mode: 0o700 });
  }
});
