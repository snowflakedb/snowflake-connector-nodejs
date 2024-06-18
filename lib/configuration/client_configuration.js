/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const os = require('os');
const path = require('path');
const fs = require('fs');
const { isString, exists, isFileNotWritableByGroupOrOthers, getDriverDirectory } = require('../util');
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

const defaultDirectories = getDefaultDirectories();

function getDefaultDirectories() {
  const directories = [];

  const driverDirectory = getDriverDirectory();

  if (driverDirectory) {
    directories.push(
      {
        dir: driverDirectory,
        dirDescription: 'driver'
      }
    );
  } else {
    Logger.getInstance().warn('Driver directory is not defined');
  }

  const homedir = os.homedir();

  if (exists(homedir)) {
    directories.push(
      {
        dir: homedir,
        dirDescription: 'home'
      }
    );
  } else {
    Logger.getInstance().warn('Home directory of the user is not present');
  }

  return directories;
}

const knownCommonEntries = ['log_level', 'log_path'];
const allLevels = Object.values(Levels);

class ClientConfig {
  constructor(filePath, loggingConfig) {
    this.configPath = filePath;
    this.loggingConfig = loggingConfig;
  }
}

class ClientLoggingConfig {
  constructor(logLevel, logPath) {
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
function levelFromString(value) {
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
    if (!exists(path) || path === '') {
      return null;
    }

    const isFileOk = await isFileNotWritableByGroupOrOthers(path, fsPromises).catch(err => {
      throw new ConfigurationError('Finding client configuration failed', err);
    });

    if (!isFileOk) {
      throw new ConfigurationError(`Configuration file: ${path} can be modified by group or others`, 'IncorrectPerms');
    }

    const configFileContents = await readFileConfig(path);
    return configFileContents == null ? null : parseConfigFile(path, configFileContents);
  };

  function readFileConfig(filePath) {
    if (!filePath) {
      return Promise.resolve(null);
    }
    return fsPromises.readFile(filePath, { encoding: 'utf8' })
      .catch(err => {
        throw new ConfigurationError('Finding client configuration failed', err);
      });
  }

  function parseConfigFile(path, configurationJson) {
    try {
      const parsedConfiguration = JSON.parse(configurationJson);
      checkUnknownEntries(parsedConfiguration);
      validate(parsedConfiguration);
      return new ClientConfig(
        path,
        new ClientLoggingConfig(
          getLogLevel(parsedConfiguration),
          getLogPath(parsedConfiguration)
        )
      );
    } catch (err) {
      throw new ConfigurationError('Parsing client configuration failed', err);
    }
  }

  function checkUnknownEntries(config) {
    for (const key in config.common) {
      if (!knownCommonEntries.includes(key.toLowerCase())) {
        Logger.getInstance().warn('Unknown configuration entry: %s with value: %s', key, config.common[key]);
      }
    }
  }

  function validate(configuration) {
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

  function getLogLevel(configuration) {
    return configuration.common.log_level;
  }

  function getLogPath(configuration) {
    return configuration.common.log_path;
  }

  async function findConfig(filePathFromConnectionString) {
    if (exists(filePathFromConnectionString)) {
      Logger.getInstance().info('Using client configuration path from a connection string: %s', filePathFromConnectionString);
      return filePathFromConnectionString;
    }
    const filePathFromEnvVariable = await getFilePathFromEnvironmentVariable();
    if (exists(filePathFromEnvVariable)) {
      Logger.getInstance().info('Using client configuration path from an environment variable: %s', filePathFromEnvVariable);
      return filePathFromEnvVariable;
    }
    const fileFromDefDirs = await searchForConfigInDefaultDirectories();
    if (exists(fileFromDefDirs)) {
      Logger.getInstance().info('Using client configuration path from %s directory: %s', fileFromDefDirs.dirDescription, fileFromDefDirs.configPath);
      return fileFromDefDirs.configPath;
    }
    Logger.getInstance().info('No client config file found in default directories');
    return null;
  }

  async function verifyNotEmpty(filePath) {
    return filePath ? filePath : null;
  }

  function getFilePathFromEnvironmentVariable() {
    return verifyNotEmpty(process.env.SF_CLIENT_CONFIG_FILE);
  }

  async function searchForConfigInDefaultDirectories() {
    for (const directory of defaultDirectories) {
      const configPath = await searchForConfigInDictionary(directory.dir, directory.dirDescription);
      if (exists(configPath)) {
        return { configPath: configPath, dirDescription: directory.dirDescription };
      }
    }
    return null;
  }

  async function searchForConfigInDictionary(directory, directoryDescription) {
    try {
      const filePath = path.join(directory, clientConfigFileName);
      return await onlyIfFileExists(filePath);
    } catch (e) {
      Logger.getInstance().error('Error while searching for the client config in %s directory: %s', directoryDescription, e);
      return null;
    }
  }

  async function onlyIfFileExists(filePath) {
    return await fsPromises.access(filePath, fs.constants.F_OK)
      .then(() => filePath)
      .catch(() => null);
  }
}

exports.Levels = Levels;
exports.levelFromString = levelFromString;
exports.ConfigurationUtil = ConfigurationUtil;
