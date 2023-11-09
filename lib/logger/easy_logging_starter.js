/*
 * Copyright (c) 2023 Snowflake Computing Inc. All rights reserved.
 */
const os = require('os');
const path = require('path');
const fsPromises = require('fs/promises');
const fs = require('fs');
const {logTagToLevel} = require('./core');
const {ConfigurationUtil, Levels} = require('../configuration/client_configuration');
const Logger = require('../logger');
const clientConfiguration = new ConfigurationUtil();
const getClientConfig = clientConfiguration.getClientConfig;

let initTrialParameters;

/**
 * This is an experimental feature. Not ready to use yet.
 * @param {string} configFilePathFromConnectionString
 * @returns {Promise<void>}
 */
exports.init = async function (configFilePathFromConnectionString) {
  try {
    if (!allowedToInitialize(configFilePathFromConnectionString)) {
      return;
    }
    const config = await getClientConfig(configFilePathFromConnectionString);
    if (!config) {
      initTrialParameters = {
        configFilePathFromConnectionString: configFilePathFromConnectionString
      };
      return;
    }
    const logLevel = mapLogLevel(config);
    const logPath = await getLogPath(config);
    const logger = Logger.getInstance();
    logger.configure({
      level: logLevel,
      filePath: path.join(logPath, 'snowflake.log')
    });
    logger.easyLoggingConfigureCounter = (logger.easyLoggingConfigureCounter ?? 0) + 1;
    initTrialParameters = {
      configFilePathFromConnectionString: configFilePathFromConnectionString
    };
  } catch (err) {
    const error = new EasyLoggingError('Failed to initialize easy logging', err);
    Logger.getInstance().error(error.toString(), error);
    throw error;
  }
};

/**
 * This is an experimental feature. Not ready to use yet.
 */
exports.reset = function () {
  initTrialParameters = undefined;
  Logger.getInstance().easyLoggingConfigureCounter = undefined;
};

function allowedToInitialize(configFilePathFromConnectionString) {
  const everTriedToInitialize = !!initTrialParameters;
  const triedToInitializeWithoutConfigFile = everTriedToInitialize && initTrialParameters.configFilePathFromConnectionString == null;
  const isGivenConfigFilePath = !!configFilePathFromConnectionString;
  const isAllowedToInitialize = !everTriedToInitialize || (triedToInitializeWithoutConfigFile && isGivenConfigFilePath);
  if (!isAllowedToInitialize && initTrialParameters.configFilePathFromConnectionString !== configFilePathFromConnectionString) {
    Logger.getInstance().warn(`Easy logging will not be configured for CLIENT_CONFIG_FILE=${configFilePathFromConnectionString}  because it was previously configured for a different client config`);
  }
  return isAllowedToInitialize;
}

function mapLogLevel(config) {
  const configLogLevel = getLogLevel(config);
  const logLevelNumber = logTagToLevel(configLogLevel);
  if (logLevelNumber === null || logLevelNumber === undefined) {
    throw new Error('Failed to convert configuration log level into internal one');
  }
  return logLevelNumber;
}

function getLogLevel(config) {
  const logLevel = config.loggingConfig.logLevel;
  if (!logLevel) {
    Logger.getInstance().warn('LogLevel in client config not found. Using default value: OFF');
    return Levels.Off;
  }
  return logLevel;
}

async function getLogPath(config) {
  let logPath = config.loggingConfig.logPath;
  if (!logPath) {
    Logger.getInstance().warn('LogPath in client config not found. Using temporary directory as a default value');
    logPath = os.tmpdir();
  }
  const pathWithNodeJsSubdirectory = path.join(logPath, 'nodejs');
  await fsPromises.access(pathWithNodeJsSubdirectory, fs.constants.F_OK)
    .then(() => true)
    .catch(() => {
      try {
        return fsPromises.mkdir(pathWithNodeJsSubdirectory, { recursive: true });
      } catch (err) {
        throw new EasyLoggingError('Failed to create the directory for logs');
      }
    });
  return pathWithNodeJsSubdirectory;
}

class EasyLoggingError extends Error {
  name = 'EasyLoggingError';

  constructor(message, cause) {
    super(message);
    this.cause = cause;
    Error.captureStackTrace(this, this.constructor);
  }

  toString() {
    return this.message + ': ' + this.cause.toString();
  }
}
