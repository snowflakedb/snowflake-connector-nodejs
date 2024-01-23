/*
 * Copyright (c) 2023 Snowflake Computing Inc. All rights reserved.
 */
const os = require('os');
const path = require('path');
const assert = require('assert');
const mock = require('mock-require');
const { Levels, ConfigurationUtil } = require('./../../../lib/configuration/client_configuration');
const defaultConfigName = 'sf_client_config.json';
const configInDriverDirectory = path.join('.', defaultConfigName);
const configInHomeDirectory = path.join(os.homedir(), defaultConfigName);
const configInTempDirectory = path.join(os.tmpdir(), defaultConfigName);
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

  it('should take config from connection string', async function () {
    // given
    const fsMock = new FsMock()
      .mockFile(configFromConnectionString, fileContent)
      .mockFile(configFromEnvVariable, 'random content')
      .mockFile(configInDriverDirectory, 'random content')
      .mockFile(configInHomeDirectory, 'random content')
      .mockFile(configInTempDirectory, 'random content');
    mockFiles(fsMock);
    mockClientConfigFileEnvVariable(configFromEnvVariable);
    const fsPromises = require('fs/promises');
    const process = require('process');
    const configUtil = new ConfigurationUtil(fsPromises, process);

    // when
    const configFound = await configUtil.getClientConfig(configFromConnectionString);

    // then
    assert.deepEqual(configFound, clientConfig);
  });

  it('should take config from environmental variable if no input present', async function () {
    // given
    const fsMock = new FsMock()
      .mockFile(configFromEnvVariable, fileContent)
      .mockFile(configInDriverDirectory, 'random content')
      .mockFile(configInHomeDirectory, 'random content')
      .mockFile(configInTempDirectory, 'random content');
    mockFiles(fsMock);
    mockClientConfigFileEnvVariable(configFromEnvVariable);
    const fsPromises = require('fs/promises');
    const process = require('process');
    const configUtil = new ConfigurationUtil(fsPromises, process);

    // when
    const configFound = await configUtil.getClientConfig(null);

    // then
    assert.deepEqual(configFound, clientConfig);
  });

  it('should take config from driver directory if no input nor environmental variable present', async function () {
    // given
    const fsMock = new FsMock()
      .mockFile(configInDriverDirectory, fileContent)
      .mockFile(configInHomeDirectory, 'random content')
      .mockFile(configInTempDirectory, 'random content');
    mockFiles(fsMock);
    mockClientConfigFileEnvVariable(undefined);
    const fsPromises = require('fs/promises');
    const process = require('process');
    const configUtil = new ConfigurationUtil(fsPromises, process);

    // when
    const configFound = await configUtil.getClientConfig(null);

    // then
    assert.deepEqual(configFound, clientConfig);
  });

  it('should take config from home directory if no input nor environmental variable nor in driver directory present', async function () {
    // given
    const fsMock = new FsMock()
      .mockFile(configInHomeDirectory, fileContent)
      .mockFile(configInTempDirectory, 'random content');
    mockFiles(fsMock);
    mockClientConfigFileEnvVariable(undefined);
    const fsPromises = require('fs/promises');
    const process = require('process');
    const configUtil = new ConfigurationUtil(fsPromises, process);

    // when
    const configFound = await configUtil.getClientConfig(null);

    // then
    assert.deepEqual(configFound, clientConfig);
  });

  it('should take config from temp directory if no other location possible', async function () {
    // given
    const fsMock = new FsMock()
      .mockFile(configInTempDirectory, fileContent);
    mockFiles(fsMock);
    mockClientConfigFileEnvVariable(undefined);
    const fsPromises = require('fs/promises');
    const process = require('process');
    const configUtil = new ConfigurationUtil(fsPromises, process);

    // when
    const configFound = await configUtil.getClientConfig(null);

    // then
    assert.deepEqual(configFound, clientConfig);
  });

  it('should return null if config could not be found', async function () {
    // given
    const fsMock = new FsMock();
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
});

function mockFiles(fsMock) {
  mock('fs/promises', {
    access: async function (path) {
      return fsMock.access(path);
    },
    readFile: async function (path){
      return fsMock.readFile(path);
    }
  });
}

function mockClientConfigFileEnvVariable(envClientConfigFileValue) {
  mock('process', {
    env: {
      SF_CLIENT_CONFIG_FILE: envClientConfigFileValue
    }
  });
}

class FsMock {
  existingFiles = new Map();

  constructor() {}

  mockFile(filePath, fileContents) {
    this.existingFiles.set(filePath, fileContents);
    return this;
  }

  async access(filePath) {
    if (!this.existingFiles.has(filePath)) {
      throw new Error('File does not exist');
    }
  }

  async readFile(filePath) {
    if (!this.existingFiles.has(filePath)) {
      throw new Error('File does not exist');
    }
    return this.existingFiles.get(filePath);
  }
}
