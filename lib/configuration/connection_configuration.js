/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const toml = require('toml');
const os = require('os');
const fsPromises = require('fs/promises');
const { validateOnlyUserReadWritePermission } = require('../file_transfer_agent/file_util');

function defaultIfNotSet(value, defaultValue) {
  if (value === null || typeof value === 'undefined' || value === '') {
    return defaultValue;
  } else {
    return value;
  }
}

async function loadConnectionConfiguration() {
  const path = defaultIfNotSet(process.env.SNOWFLAKE_HOME, os.homedir() + '/.snowflake/');
  const filePath = path + 'connections.toml';
  await validateOnlyUserReadWritePermission(filePath);
  const str = await fsPromises.readFile(filePath, {encoding: 'utf8'});

  const parsingResult = toml.parse(str);
  const configurationName = defaultIfNotSet(process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME, 'default');
  if (parsingResult[configurationName] !== undefined) {
    return parsingResult[configurationName];
  } else {
    throw new Error(`Connection configuration with name ${configurationName} does not exist`);
  }
}

exports.loadConnectionConfiguration = loadConnectionConfiguration;
