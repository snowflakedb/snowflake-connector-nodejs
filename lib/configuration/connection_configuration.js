/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const toml = require('toml');
const os = require('os');
const fs = require('fs');
const { validateOnlyUserReadWritePermission } = require('../file_transfer_agent/file_util');
const path = require('path');
const Logger = require('../logger');
const { authenticationTypes} = require('../authentication/authentication');
const Util = require('../util');

function defaultIfNotSet(value, defaultValue) {
  if (value === null || typeof value === 'undefined' || value === '') {
    return defaultValue;
  } else {
    return value;
  }
}

function loadConnectionConfiguration() {
  const snowflakeConfigDir = defaultIfNotSet(process.env.SNOWFLAKE_HOME, path.join(os.homedir(), '.snowflake'));
  const filePath = path.join(snowflakeConfigDir, 'connections.toml');
  Logger.getInstance().trace('Connection configuration file is : %s', filePath);
  validateOnlyUserReadWritePermission(filePath);
  const str = fs.readFileSync(filePath, { encoding: 'utf8' });
  const parsingResult = toml.parse(str);
  const configurationName = defaultIfNotSet(process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME, 'default');

  function shouldReadTokenFromFile(fixedConfiguration) {
    return fixedConfiguration && fixedConfiguration.authenticator &&
      fixedConfiguration.authenticator.toUpperCase() === authenticationTypes.OAUTH_AUTHENTICATOR &&
      !Util.string.isNotNullOrEmpty(fixedConfiguration.token);
  }

  if (parsingResult[configurationName] !== undefined) {
    const fixedConfiguration = fixUserKey(parsingResult[configurationName]);
    Logger.getInstance().info('Connection configuration has been read from file: %s', filePath);
    if (shouldReadTokenFromFile(fixedConfiguration)) {
      const tokenFilePath = fixedConfiguration.token_file_path ? fixedConfiguration.token_file_path : '/snowflake/session/token';
      Logger.getInstance().trace('Token file path is : %s', tokenFilePath);
      validateOnlyUserReadWritePermission(tokenFilePath);
      fixedConfiguration.token = fs.readFileSync(tokenFilePath, 'utf-8').trim();
      Logger.getInstance().info('Token used in connection has been read from file: %s', tokenFilePath);
    }
    return fixedConfiguration;
  } else {
    throw new Error(`Connection configuration with name ${configurationName} does not exist`);
  }
}

function fixUserKey(parsingResult) {
  if (parsingResult['username'] === undefined && parsingResult['user'] !== undefined){
    parsingResult['username'] = parsingResult['user'];
  }
  return parsingResult;
}

exports.loadConnectionConfiguration = loadConnectionConfiguration;
