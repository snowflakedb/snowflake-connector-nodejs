/*
 * Copyright (c) 2015-2023 Snowflake Computing Inc. All rights reserved.
 */

const path = require('path');
const GlobalConfig = require('../../global_config');
const Logger = require('../../logger');
// const fs = require('fs/promises');
const fs = require('fs');

function getCredentialCacheDir() {
  const cacheDirectory = GlobalConfig.mkdirCacheDir(process.env.SF_TEMPORARY_CREDENTIAL_CACHE_DIR);
  const credCache = path.join(cacheDirectory, 'temporary_credential.json');
  Logger.getInstance().info('Cache directory: ', credCache);
  return credCache;
}

function renewToken(json, host, user, credType, token) {
  json[host] = json[host] || {};
  json[host][user] = json[host][user] || {};
  json[host][user][credType] = token;
  return json;
}

function readCredentialFile() {
  const cred = fs.readFileSync(getCredentialCacheDir(), 'utf8');
  try {
    return JSON.parse(cred);
  } catch (err) {
    return null;
  }
}

function findCredential(json, host, user, credType) {
  const keys = [host, user, credType];
  let credObject = json;
  for (const key of keys) {
    if (credObject.hasOwnProperty(key)) {
      credObject = credObject[key];
    } else {
      credObject = null;
      break;
    }
  }
  return credObject;
}

/**
 * 
 * @param {String} host 
 * @param {String} user 
 * @param {String} credType 
 * @returns 
 */
function writeCredential(host, user, credType, token){
  let credential = null;

  if (fs.existsSync(getCredentialCacheDir())){
    credential = readCredentialFile();
  }

  if (!credential) {
    credential = {};
  }

  const newCredential = renewToken(credential, host, user, credType, token);
 
  fs.writeFileSync(getCredentialCacheDir(), JSON.stringify(newCredential), 'utf8');
}

function readCredential(host, user, credType) {
  if (!fs.existsSync(getCredentialCacheDir())){
    Logger.getInstance().info('Cannot find the credential file from the directory');
    return null;
  }
  const credential = readCredentialFile();
  return findCredential(credential, host, user, credType);
}

function deleteCredential(host, user, credType) {
  if (!fs.existsSync(getCredentialCacheDir())){
    Logger.getInstance().info('Cannot find the credential file from the directory');
    return null;
  }
  const credential = readCredentialFile();

  if (findCredential(credential, host, user, credType)) {
    credential[host][user][credType] = null;
    fs.writeFileSync(getCredentialCacheDir(), JSON.stringify(credential), 'utf8');
  }
}

module.exports = {
  renewToken,
  findCredential,
  getCredentialCacheDir, 
  writeCredential,
  readCredential, 
  deleteCredential 
};