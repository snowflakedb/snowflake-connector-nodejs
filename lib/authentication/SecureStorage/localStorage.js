/*
 * Copyright (c) 2015-2023 Snowflake Computing Inc. All rights reserved.
 */

const path = require('path');
const GlobalConfig = require('../../global_config');
const Logger = require('../../logger');
const fs = require('fs/promises');
const dir = getCredentialCacheDir();

function getCredentialCacheDir() {
  const cacheDirectory = GlobalConfig.mkdirCacheDir(process.env.SF_TEMPORARY_CREDENTIAL_CACHE_DIR);
  const credCache = path.join(cacheDirectory, 'temporary_credential.json');
  Logger.getInstance().info('Cache directory: ', credCache);
  return credCache;
}

function renewToken(json, host, user, credType, token) {
  json[host] = json[host] || {};
  json[host][user] = json[host][user] || {};
  json[host][user][credType] = { token };
  return json;
}

async function readCredentialFile() {
  return JSON.parse(await fs.readFile(dir, 'utf8'));
}

function findCredential(json, host, user, credType) {
  const keys = [host, user, credType];
  let credObject = json;
  for (const key in keys) {
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
async function writeCredential(host, user, credType, token){
  const credential = await readCredentialFile();
  let newCredential;
  if (credential) {
    newCredential = renewToken(credential, host, user, credType, token);
  } else {
    newCredential = {
      host: {
        user: {
          credType: token
        }
      }
    };
  }
  await fs.writeFile(dir, newCredential, 'utf8');
}

async function readCredential(host, user, credType) {
  const credential = await readCredentialFile();
  return findCredential(credential, host, user, credType);
}

async function deleteCredential(host, user, credType) {
  const credential = await readCredentialFile();
  if (findCredential(credential, host, user, credType)) {
    credential[host][user][credType] = null;
  }
}

module.exports = { 
  findCredential,
  getCredentialCacheDir, 
  writeCredential,
  readCredential, 
  deleteCredential 
};