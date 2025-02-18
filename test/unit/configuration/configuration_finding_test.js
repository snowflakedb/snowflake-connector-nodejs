const os = require('os');
const path = require('path');
const assert = require('assert');
const mock = require('mock-require');
const { Levels, ConfigurationUtil } = require('./../../../lib/configuration/client_configuration');
const { getDriverDirectory } = require('./../../../lib/util');
const { mockFiles, mockClientConfigFileEnvVariable, createFsMock } = require('../mock/mock_file');
const defaultConfigName = 'sf_client_config.json';
const badPermissionsConfig = 'bad_perm_config.json';
const driverDirectory = getDriverDirectory();
const configInDriverDirectory = path.join(driverDirectory, defaultConfigName);
const configInHomeDirectory = path.join(os.homedir(), defaultConfigName);
const configFromEnvVariable = 'env_config.json';
const configFromConnectionString = 'conn_config.json';
const logLevel = Levels.Info;
const logPath = '/some-path/some-directory';
const fileContent = `{
  "common": {
    "log_level": "${logLevel}",
    "log_path": "${logPath}"
  } 
}`;
const clientConfig = {
  loggingConfig: {
    logLevel: logLevel,
    logPath: logPath
  }
};

describe('Configuration finding tests', function () {

  after(() => {
    if (!driverDirectory) {
      assert.fail('driver directory not set');
    }
    mock.stop('fs/promises');
    mock.stop('process');
  });

  it('should take config from connection string', async function () {
    // given
    const fsMock = createFsMock()
      .mockFile(configFromConnectionString, fileContent)
      .mockFile(configFromEnvVariable, 'random content')
      .mockFile(configInDriverDirectory, 'random content')
      .mockFile(configInHomeDirectory, 'random content');
    mockFiles(fsMock);
    mockClientConfigFileEnvVariable(configFromEnvVariable);
    const fsPromises = require('fs/promises');
    const process = require('process');
    const configUtil = new ConfigurationUtil(fsPromises, process);
    clientConfig.configPath = 'conn_config.json';

    // when
    const configFound = await configUtil.getClientConfig(configFromConnectionString);

    // then
    assert.deepEqual(configFound, clientConfig);
  });

  it('should take config from environmental variable if no input present', async function () {
    // given
    const fsMock = createFsMock()
      .mockFile(configFromEnvVariable, fileContent)
      .mockFile(configInDriverDirectory, 'random content')
      .mockFile(configInHomeDirectory, 'random content');
    mockFiles(fsMock);
    mockClientConfigFileEnvVariable(configFromEnvVariable);
    const fsPromises = require('fs/promises');
    const process = require('process');
    const configUtil = new ConfigurationUtil(fsPromises, process);
    clientConfig.configPath = 'env_config.json';

    // when
    const configFound = await configUtil.getClientConfig(null);

    // then
    assert.deepEqual(configFound, clientConfig);
  });

  it('should take config from driver directory if no input nor environmental variable present', async function () {
    // given
    const fsMock = createFsMock()
      .mockFile(configInDriverDirectory, fileContent)
      .mockFile(configInHomeDirectory, 'random content');
    mockFiles(fsMock);
    mockClientConfigFileEnvVariable(undefined);
    const fsPromises = require('fs/promises');
    const process = require('process');
    const configUtil = new ConfigurationUtil(fsPromises, process);
    clientConfig.configPath = configInDriverDirectory;

    // when
    const configFound = await configUtil.getClientConfig(null);

    // then
    assert.deepEqual(configFound, clientConfig);
  });

  it('should take config from home directory if no input nor environmental variable nor in driver directory present', async function () {
    // given
    const fsMock = createFsMock()
      .mockFile(configInHomeDirectory, fileContent);
    mockFiles(fsMock);
    mockClientConfigFileEnvVariable(undefined);
    const fsPromises = require('fs/promises');
    const process = require('process');
    const configUtil = new ConfigurationUtil(fsPromises, process);
    clientConfig.configPath = path.join(os.homedir(), 'sf_client_config.json');

    // when
    const configFound = await configUtil.getClientConfig(null);

    // then
    assert.deepEqual(configFound, clientConfig);
  });

  it('should return null if config could not be found', async function () {
    // given
    const fsMock = createFsMock();
    mockFiles(fsMock);
    mockClientConfigFileEnvVariable(undefined);
    const fsPromises = require('fs/promises');
    const process = require('process');
    const configUtil = new ConfigurationUtil(fsPromises, process);

    // when
    const configFound = await configUtil.getClientConfig(null);

    // then
    assert.strictEqual(configFound, null);
  });

  if (os.platform() !== 'win32') {
    it('should fail to open config when file has bad permissions', async function () {
      // given
      const fsMock = createFsMock()
        .mockFile(badPermissionsConfig, 'gibberish');
      mockFiles(fsMock);
      const fsPromises = require('fs/promises');
      const process = require('process');
      const configUtil = new ConfigurationUtil(fsPromises, process);

      // when
      const config = configUtil.getClientConfig(badPermissionsConfig);

      //then
      await assert.rejects(
        async () => await config,
        (err) => {
          assert.strictEqual(err.name, 'ConfigurationError');
          assert.strictEqual(err.message, `Configuration file: ${badPermissionsConfig} can be modified by group or others`);
          assert.strictEqual(err.cause, 'IncorrectPerms');
          return true;
        });
    });
  }
});
