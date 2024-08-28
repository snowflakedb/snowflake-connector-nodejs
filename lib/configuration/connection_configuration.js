/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const toml = require('toml');
const os = require('os');
const fs = require('fs');
const { validateOnlyUserReadWritePermission, generateChecksum } = require('../file_transfer_agent/file_util');
const path = require('path');
const Logger = require('../logger');
const { authenticationTypes } = require('../authentication/authentication');
const Util = require('../util');

function defaultIfNotSet(value, defaultValue) {
  if (value === null || typeof value === 'undefined' || value === '') {
    return defaultValue;
  } else {
    return value;
  }
}

function shouldReadTokenFromFile(fixedConfiguration) {
  return fixedConfiguration && fixedConfiguration.authenticator &&
    fixedConfiguration.authenticator.toUpperCase() === authenticationTypes.OAUTH_AUTHENTICATOR &&
    !Util.string.isNotNullOrEmpty(fixedConfiguration.token);
}

function readTokenFromFile(fixedConfiguration) {
  const tokenFilePath = fixedConfiguration.token_file_path ? fixedConfiguration.token_file_path : '/snowflake/session/token';
  const resolvedPath = fs.realpathSync(tokenFilePath);
  Logger.getInstance().trace('Token file path is : %s', tokenFilePath);
  validateOnlyUserReadWritePermission(resolvedPath);
  fixedConfiguration.token = fs.readFileSync(resolvedPath, 'utf-8').trim();
  if (!fixedConfiguration.token) {
    throw new Error('The token does not exist or has empty value');
  }
  const tokenChecksum = generateChecksum(fixedConfiguration.token);
  Logger.getInstance().info('Token used in connection has been read from file: %s. Checksum: %s', resolvedPath, tokenChecksum);
}

function loadConnectionConfiguration() {
  const snowflakeConfigDir = defaultIfNotSet(process.env.SNOWFLAKE_HOME, path.join(os.homedir(), '.snowflake'));
  const filePath = path.join(snowflakeConfigDir, 'connections.toml');
  const resolvedPath = fs.realpathSync(filePath);
  validateOnlyUserReadWritePermission(resolvedPath);
  const str = fs.readFileSync(resolvedPath, { encoding: 'utf8' });
  const configurationChecksum = generateChecksum(str);
  Logger.getInstance().info('Connection configuration file is read from file: %s. Checksum: %s', resolvedPath, configurationChecksum);
  const parsingResult = toml.parse(str);
  const configurationName = defaultIfNotSet(process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME, 'default');

  if (parsingResult[configurationName] !== undefined) {
    const fixedConfiguration = fixUserKey(parsingResult[configurationName]);
    if (shouldReadTokenFromFile(fixedConfiguration)) {
      readTokenFromFile(fixedConfiguration);
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
