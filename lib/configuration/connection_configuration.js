/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const toml = require('toml');
const os = require('os');
const fs = require('fs');
const { validateOnlyUserReadWritePermission } = require('../file_transfer_agent/file_util');

function defaultIfNotSet(value, defaultValue) {
  if (value === null || typeof value === 'undefined' || value === '') {
    return defaultValue;
  } else {
    return value;
  }
}

function loadConnectionConfiguration() {
  const path = defaultIfNotSet(process.env.SNOWFLAKE_HOME, os.homedir() + '/.snowflake/');
  const filePath = path + 'connections.toml';
  validateOnlyUserReadWritePermission(filePath);
  const str = fs.readFileSync(filePath, { encoding: 'utf8' });
  const parsingResult = toml.parse(str);
  const configurationName = defaultIfNotSet(process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME, 'default');
  if (parsingResult[configurationName] !== undefined) {
    fixUserKey(parsingResult[configurationName]);
    return parsingResult[configurationName];
  } else {
    throw new Error(`Connection configuration with name ${configurationName} does not exist`);
  }
}

function fixUserKey(parsingResult) {
  if (parsingResult['username'] === undefined && parsingResult['user'] !== undefined){
    parsingResult['username'] = parsingResult['user'];
  }
}

exports.loadConnectionConfiguration = loadConnectionConfiguration;
