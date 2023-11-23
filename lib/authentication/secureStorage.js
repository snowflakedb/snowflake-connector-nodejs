/*
 * Copyright (c) 2015-2023 Snowflake Computing Inc. All rights reserved.
 */

const path = require('path');
const GlobalConfig = require('../global_config');
const Logger = require('../logger');
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
    return;
  } else {
    try {
      try {
        const keytar = require('keytar');
        await keytar.setPassword(host, buildTemporaryCredentialName(host, user, credType), token);
      } catch(err) {
        const dir = createCredentialCacheDir();
        await fs.writeFile(dir, token, 'utf8');
      }
    // try{
    //   const dir = createCredentialCacheDir();
    //   await fs.writeFile(dir, token, 'utf8');
    }
    catch (err){
      Logger.getInstance().error('Failed to save Credential: ', err.message);
    } 
  }
}

async function readCredential(host, user, credType) {
  try{
    try{
      const keytar = require('keytar');
      return await keytar.getPassword(host, buildTemporaryCredentialName(host, user, credType));
    }catch(err) {
      const dir = createCredentialCacheDir();
      return await fs.readFile(dir, 'utf8');
    }

      // const dir = createCredentialCacheDir();
      // return await fs.readFile(dir, 'utf8');
  }catch (err){
    Logger.getInstance().error('Failed to save Credential: ', err.message);
  } 
}

async function deleteCredential(host, user, credType) {
  try{
    try{
      const keytar = require('keytar');
      return await keytar.deletePassword(host, buildTemporaryCredentialName(host, user, credType));
    }catch(err) {
      const dir = createCredentialCacheDir();
      return await fs.unlink(dir);
    }

    // const dir = createCredentialCacheDir();
    // return await fs.unlink(dir);
  }catch (err){
    Logger.getInstance().error('Failed to save Credential: ', err.message);
  } 
}

module.exports = { 
  createCredentialCacheDir, 
  buildTemporaryCredentialName, 
  writeCredential,
  readCredential, 
  deleteCredential 
};