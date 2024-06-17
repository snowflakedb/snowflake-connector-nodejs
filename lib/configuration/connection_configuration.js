/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const toml = require('toml');
const os = require('os');
const fsPromises = require('fs/promises');
const {validateOnlyUserReadWritePermission} = require('../file_transfer_agent/file_util');

function defaultIfNotSet(value, defaultValue) {
  if (value === null || typeof value === 'undefined' || value === '') {
    return defaultValue;
  } else {
    return value;
  }
}

async function laodConnectionConfiguration() {
  const path = defaultIfNotSet(process.env.SNOWFLAKE_HOME, os.homedir() + '/.snowflake/');
  const filePath = path + 'connections.toml';
  validateOnlyUserReadWritePermission(filePath);
  const str =  await fsPromises.readFile(filePath, { encoding: 'utf8' });

  try {
    const parsingResult = toml.parse(str);
    const configurationName = defaultIfNotSet(process.env.SNOWFLAKE_DEFAULT_CONNECTION_NAME, 'default');
    if (parsingResult[configurationName] !== undefined) {
      return Promise.resolve(parsingResult[configurationName]);
    } else {
      return Promise.reject(`Connection configuration with name ${configurationName} does not exist`);
    }

  } catch (e) {
    return Promise.reject(e);
  }
}


exports.laodConnectionConfiguration = laodConnectionConfiguration;
