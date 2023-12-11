/*
 * Copyright (c) 2015-2023 Snowflake Computing Inc. All rights reserved.
 */

const path = require('path');
const GlobalConfig = require('../../global_config');
const Logger = require('../../logger');
const fs = require('fs');
const Util = require('../../util');

function getCredentialCacheDir() {
  const cacheDirectory = GlobalConfig.mkdirCacheDir(process.env.SF_TEMPORARY_CREDENTIAL_CACHE_DIR);
  const credCache = path.join(cacheDirectory, 'temporary_credential.json');
  Logger.getInstance().info('Cache directory: ', credCache);
  return credCache;
}

function readCredentialFile() {
  const cred = fs.readFileSync(getCredentialCacheDir(), 'utf8');
  try {
    return JSON.parse(cred);
  } catch (err) {
    return null;
  }
}

function write(key, token){
  if (!Util.checkParametersDefined(key)) {
    return null;
  }
  let jsonCredential = null;

  if (fs.existsSync(getCredentialCacheDir())){
    jsonCredential = readCredentialFile() || {};
  } else {
    jsonCredential = {}; 
  }
  jsonCredential[key] = token;
 
  fs.writeFileSync(getCredentialCacheDir(), JSON.stringify(jsonCredential), 'utf8');
}

function read(key) {
  if (!Util.checkParametersDefined(key)) {
    return null;
  }
  try {
    if (!fs.existsSync(getCredentialCacheDir())){
      Logger.getInstance().info('Cannot find the credential file from the directory');
      return null;
    }
    const jsonCredential = readCredentialFile();
    return jsonCredential[key] || null;
  }
  catch (err){
    Logger.getInstance().error('Failed to delete Credential: ', err.message);
  } 
}

function remove(key) {
  if (!Util.checkParametersDefined(key)) {
    return null;
  }
  try {
    if (!fs.existsSync(getCredentialCacheDir())){
      Logger.getInstance().info('Cannot find the credential file from the directory');
      return null;
    }
    const jsonCredential = readCredentialFile();
  
    if (jsonCredential[key]) {
      jsonCredential[key] = null;
      fs.writeFileSync(getCredentialCacheDir(), JSON.stringify(jsonCredential), 'utf8');
    }
  }
  catch (err){
    Logger.getInstance().error('Failed to delete Credential: ', err.message);
  } 
  
}

module.exports = {
  read,
  write, 
  remove 
};