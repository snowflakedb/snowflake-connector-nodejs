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
  Logger.getInstance().debug(`Detected driver directory: ${driverDirectory}`);

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
  Logger.getInstance().debug(`Detected home directory: ${homedir}`);

  if (exists(homedir)) {
    directories.push(
      {
        dir: homedir,
        dirDescription: 'home'
      }
    );
  } else {
    Logger.getInstance().warn('Home directory of the user is not defined');
  }

  Logger.getInstance().debug(`Detected default directories: ${driverDirectory}`);
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

    Logger.getInstance().error(`Tried to create unsupported log level from string: ${value}`);
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
    Logger.getInstance().debug('Retrieving client config');

    const path = await findConfig(configFilePath);
    if (!exists(path) || path === '') {
      Logger.getInstance().info('No config file path found. Client config will not be used.');
      return null;
    }

    const isFileOk = await isFileNotWritableByGroupOrOthers(path, fsPromises).catch(err => {
      Logger.getInstance().warn('Failed to inspect config file path permissions. Client config will not be used.');
      throw new ConfigurationError('Finding client configuration failed', err);
    });

    if (!isFileOk) {
      Logger.getInstance().warn(`Config file path permissions are invalid. File: ${path} can be modified by group or others. Client config will not be used.`);
      throw new ConfigurationError(`Configuration file: ${path} can be modified by group or others`, 'IncorrectPerms');
    }
    Logger.getInstance().debug(`Config file path permissions are valid. Path: ${path}`);

    const configFileContents = await readFileConfig(path);
    Logger.getInstance().info('Using client configuration from path: %s', path);

    return configFileContents == null ? null : parseConfigFile(path, configFileContents);
  };

  function readFileConfig(filePath) {
    Logger.getInstance().debug(`Reading config file. Path: ${filePath}`);

    if (!filePath) {
      Logger.getInstance().trace(`Path of config file is not specified. Nothing to read. Path: ${filePath}`);
      return Promise.resolve(null);
    }
    return fsPromises.readFile(filePath, { encoding: 'utf8' })
      .catch(err => {
        Logger.getInstance().debug(`Reading configuration from the file failed. Path: ${filePath}`);
        throw new ConfigurationError('Finding client configuration failed', err);
      });
  }

  function parseConfigFile(path, configurationJson) {
    Logger.getInstance().debug('Parsing config file: %s', path);
    try {
      const parsedConfiguration = JSON.parse(configurationJson);
      Logger.getInstance().trace('Config file contains correct JSON structure. Validating the input.');

      checkUnknownEntries(parsedConfiguration);
      validate(parsedConfiguration);

      Logger.getInstance().debug('Config file contains valid configuration input.');

      const clientConfig = new ClientConfig(
        path,
        new ClientLoggingConfig(
          getLogLevel(parsedConfiguration),
          getLogPath(parsedConfiguration)
        )
      );

      Logger.getInstance().info('Client Configuration created with Log Level: %s and Log Path: %s', clientConfig.loggingConfig.logLevel, clientConfig.loggingConfig.logPath);
      return clientConfig;

    } catch (err) {
      Logger.getInstance().error('Parsing client configuration failed. Used config file from path: %s', path);
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
      Logger.getInstance().debug('Log level is not specified.');
      return;
    }
    if (!isString(logLevel)) {
      const errorMessage = 'Log level is not a string.';
      Logger.getInstance().error(errorMessage);
      throw new Error(errorMessage);
    }
    levelFromString(logLevel);
  }

  function validateLogPath(configuration) {
    const logPath = getLogPath(configuration);
    if (logPath == null) {
      Logger.getInstance().debug('Log path is not specified');
      return;
    }
    if (!isString(logPath)) {
      const errorMessage = 'Log path is not a string.';
      Logger.getInstance().error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  function getLogLevel(configuration) {
    return configuration.common.log_level;
  }

  function getLogPath(configuration) {
    return configuration.common.log_path;
  }

  async function findConfig(filePathFromConnectionString) {
    Logger.getInstance().trace(`findConfig() called with param: ${filePathFromConnectionString}`);
    if (exists(filePathFromConnectionString)) {
      Logger.getInstance().info('Found client configuration path in a connection string. Path: %s', filePathFromConnectionString);
      return filePathFromConnectionString;
    }
    const filePathFromEnvVariable = await getFilePathFromEnvironmentVariable();
    if (exists(filePathFromEnvVariable)) {
      Logger.getInstance().info('Found client configuration path in an environment variable. Path: %s', filePathFromEnvVariable);
      return filePathFromEnvVariable;
    }
    const fileFromDefDirs = await searchForConfigInDefaultDirectories();
    if (exists(fileFromDefDirs)) {
      Logger.getInstance().info('Found client configuration path in %s directory. Path: %s', fileFromDefDirs.dirDescription, fileFromDefDirs.configPath);
      return fileFromDefDirs.configPath;
    }
    Logger.getInstance().info('No client config detected.');
    return null;
  }

  async function verifyNotEmpty(filePath) {
    return filePath ? filePath : null;
  }

  function getFilePathFromEnvironmentVariable() {
    return verifyNotEmpty(process.env.SF_CLIENT_CONFIG_FILE);
  }

  async function searchForConfigInDefaultDirectories() {
    Logger.getInstance().debug(`Searching for config in default directories: ${defaultDirectories}`);
    for (const directory of defaultDirectories) {
      const configPath = await searchForConfigInDictionary(directory.dir, directory.dirDescription);
      if (exists(configPath)) {
        Logger.getInstance().debug(`Config found in the default directory: ${directory.dir}. Path: ${configPath}`);
        return { configPath: configPath, dirDescription: directory.dirDescription };
      }
    }
    Logger.getInstance().debug('Unable to find config in any default directory.');
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
