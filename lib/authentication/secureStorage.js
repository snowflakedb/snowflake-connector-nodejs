/*
 * Copyright (c) 2015-2023 Snowflake Computing Inc. All rights reserved.
 */

const path = require('path');
const GlobalConfig = require('../global_config');
const Logger = require('../logger');
const keytar = require('keytar');
const os = require('os');
const fs = require('fs/promises');

function createCredentialCacheDir() {
  const cacheDirectory = GlobalConfig.mkdirCacheDir(process.env.SF_TEMPORARY_CREDENTIAL_CACHE_DIR);
  const credCache = path.join(cacheDirectory, 'temporary_credential.json');
  Logger.getInstance().info('Cache directory: ', credCache);
  return credCache;
}

/**
 * 
 * @param {String} host 
 * @param {String} user 
 * @param {String} credType 
 * @returns 
 */

function isLinuxMachine() {
  const osList = ['win32','darwin'];
  return !osList.some((element)=> element === os.platform()); 
}

function buildTemporaryCredentialName(host, user, credType) {
  return `{${host.toUpperCase()}}:{${user.toUpperCase()}}:{SF_NODE_JS_DRIVER}:{${credType}}}`;
}

async function writeCredential(host, user, credType, token){
  Logger.getInstance().trace('The os is ', os.platform());
  if (!token || token === '') {
    Logger.getInstance().debug('Token is not provided');
  } else {
    try {
      if (isLinuxMachine()) {
        const dir = createCredentialCacheDir();
        await fs.writeFile(dir, token, 'utf8');
      } else {
        await keytar.setPassword(host, buildTemporaryCredentialName(host, user, credType), token);
      }
    } catch (err){
      Logger.getInstance().error('Failed to save Credential: ', err.message);
    } 
  }
}

async function readCredential(host, user, credType) {
  Logger.getInstance().trace('The os is ', os.platform());

  if (isLinuxMachine()) {
    const dir = createCredentialCacheDir();
    return await fs.readFile(dir, 'utf8');
  } else {
    return await keytar.getPassword(host, buildTemporaryCredentialName(host, user, credType));
  }
}

async function deleteCredential(host, user, credType) {
  Logger.getInstance().trace('The os is ', os.platform());

  if (isLinuxMachine()) {
    const dir = createCredentialCacheDir();
    return await fs.unlink(dir);
  } else {
    await keytar.deletePassword(host, buildTemporaryCredentialName(host, user, credType));
  }
}

module.exports = { 
  createCredentialCacheDir, 
  buildTemporaryCredentialName, 
  writeCredential,
  readCredential, 
  deleteCredential 
};