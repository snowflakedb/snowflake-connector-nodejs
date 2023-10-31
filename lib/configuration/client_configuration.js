/*
 * Copyright (c) 2023 Snowflake Computing Inc. All rights reserved.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');
const {isString} = require('../util');
const Logger = require('../logger');
const clientConfigFileName = 'sf_client_config.json';

const Levels = Object.freeze({
  Off: 'OFF',
  Error: 'ERROR',
  Warn: 'WARN',
  Info: 'INFO',
  Debug: 'DEBUG',
  Trace: 'TRACE'
});

const allLevels = Object.values(Levels);

class ClientConfig {
  constructor (loggingConfig) {
    this.loggingConfig = loggingConfig;
  }
}

class ClientLoggingConfig {
  constructor (logLevel, logPath) {
    this.logLevel = logLevel;
    this.logPath = logPath;
  }
}

class ConfigurationError extends Error {
  name = 'ConfigurationError';

  constructor(message, cause) {
    super(message);
    this.cause = cause;
    Error.captureStackTrace(this, this.constructor);
  }

  toString() {
    return this.message + ': ' + this.cause.toString();
  }
}

/**
 * @param value {String} Log level.
 * @return {String} normalized log level value.
 * @throws {Error} Error for unknown value.
 */
function levelFromString (value) {
  const level = value.toUpperCase();
  if (!allLevels.includes(level)) {
    throw new Error('Unknown log level: ' + value);
  }
  return level;
}

/**
 * @param fsPromisesModule {module} filestream module
 * @param processModule {processModule} process module
 */
function ConfigurationUtil(fsPromisesModule, processModule) {

  const fsPromises = typeof fsPromisesModule !== 'undefined' ? fsPromisesModule : require('fs/promises');
  const process = typeof processModule !== 'undefined' ? processModule : require('process');

  /**
   * @param configFilePath {String} A path to a client config file.
   * @return {Promise<ClientConfig>} Client configuration.
   */
  this.getClientConfig = async function (configFilePath) {
    const path = await findConfig(configFilePath);
    if (path == null) {
      return null;
    }
    const configFileContents = await readFileConfig(path);
    return configFileContents == null ? null : parseConfigFile(configFileContents);
  };

  function readFileConfig (filePath) {
    if (!filePath) {
      return Promise.resolve(null);
    }
    return fsPromises.readFile(filePath, { encoding: 'utf8' })
      .catch(err => {
        throw new ConfigurationError('Finding client configuration failed', err);
      });
  }

  function parseConfigFile (configurationJson) {
    try {
      const parsedConfiguration = JSON.parse(configurationJson);
      validate(parsedConfiguration);
      return new ClientConfig(
        new ClientLoggingConfig(
          getLogLevel(parsedConfiguration),
          getLogPath(parsedConfiguration)
        )
      );
    } catch (err) {
      throw new ConfigurationError('Parsing client configuration failed', err);
    }
  }

  function validate (configuration) {
    validateLogLevel(configuration);
    validateLogPath(configuration);
  }

  function validateLogLevel(configuration) {
    const logLevel = getLogLevel(configuration);
    if (logLevel == null) {
      return;
    }
    if (!isString(logLevel)) {
      throw new Error('Log level is not a string');
    }
    levelFromString(logLevel);
  }

  function validateLogPath(configuration) {
    const logPath = getLogPath(configuration);
    if (logPath == null) {
      return;
    }
    if (!isString(logPath)) {
      throw new Error('Log path is not a string');
    }
  }

  function getLogLevel (configuration) {
    return configuration.common.log_level;
  }

  function getLogPath (configuration) {
    return configuration.common.log_path;
  }

  function findConfig (filePathFromConnectionString) {
    return verifyNotEmpty(filePathFromConnectionString)
      .then((filePath) => filePath ?? getFilePathFromEnvironmentVariable())
      .then((filePath) => filePath ?? searchForConfigInDictionary(() => '.', 'driver'))
      .then((filePath) => filePath ?? searchForConfigInDictionary(() => os.homedir(), 'home'))
      .then((filePath) => filePath ?? searchForConfigInDictionary(() => os.tmpdir(), 'temp'));
  }

  async function verifyNotEmpty (filePath) {
    return filePath ? filePath : null;
  }

  function getFilePathFromEnvironmentVariable () {
    return verifyNotEmpty(process.env.SF_CLIENT_CONFIG_FILE);
  }

  async function searchForConfigInDictionary (directoryProvider, directoryDescription) {
    try {
      const directory = directoryProvider();
      const filePath = path.join(directory, clientConfigFileName);
      return onlyIfFileExists(filePath);
    } catch (e) {
      Logger.getInstance().error('Error while searching for the client config in %s directory: %s', directoryDescription, e);
      return null;
    }
  }

  async function onlyIfFileExists (filePath) {
    return await fsPromises.access(filePath, fs.constants.F_OK)
      .then(() => filePath)
      .catch(() => null);
  }
}

exports.Levels = Levels;
exports.levelFromString = levelFromString;
exports.ConfigurationUtil = ConfigurationUtil;
