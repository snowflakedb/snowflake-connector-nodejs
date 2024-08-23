/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const path = require('path');
const Logger = require('../../logger');
const fs = require('node:fs/promises');
const os = require('os');
const Util = require('../../util');

function JsonCredentialManager(credentialCacheDir) {

  async function validatePermission(filePath) {
    try {
      await fs.access(filePath, fs.constants.F_OK);
    } catch (err) {
      return;
    }

    const mode = (await fs.stat(filePath)).mode;
    const permission = mode & 0o600;

    //This should be 600 permission, which means the file permission has not been changed by others.
    if (permission.toString(8) === '600') {
      Logger.getInstance().debug('Validated that the user has read and write permission');
    } else {
      throw new Error('You do not have read permission or the file has been changed on the user side. Please remove the token file and re run the driver.');
    }
  }
  
  this.getTokenDir = async function () {
    let tokenDir = credentialCacheDir;
    if (!Util.exists(tokenDir)) {
      tokenDir = os.homedir();
    } else {
      Logger.getInstance().info(`The credential cache directory is configured by the user. The token will be saved at ${tokenDir}`);
    }

    if (!Util.exists(tokenDir)) {
      throw new Error(`Temporary credential cache directory is invalid, and the driver is unable to use the default location(home). 
      Please assign the environment variable value SF_TEMPORARY_CREDENTIAL_CACHE_DIR to enable the default credential manager.`);
    }

    const tokenCacheFile = path.join(tokenDir, 'temporary_credential.json');
    await validatePermission(tokenCacheFile);
    return tokenCacheFile;
  };
   
  this.readJsonCredentialFile = async function () {
    try {
      const cred = await fs.readFile(await this.getTokenDir(), 'utf8');
      return JSON.parse(cred);
    } catch (err) {
      Logger.getInstance().warn('Failed to read token data from the file. Please check the permission or the file format of the token.');
      return null;
    }
  };
  
  this.write = async function (key, token) {
    if (!validateTokenCacheOption(key)) {
      return null;
    }
  
    const jsonCredential = await this.readJsonCredentialFile() || {};
    jsonCredential[key] = token;
   
    try {
      await fs.writeFile(await this.getTokenDir(), JSON.stringify(jsonCredential), { mode: 0o600 });
    } catch (err) {
      throw new Error(`Failed to write token data. Please check the permission or the file format of the token. ${err.message}`);
    }
  };
  
  this.read = async function (key) {
    if (!validateTokenCacheOption(key)) {
      return null;
    }

    const jsonCredential = await this.readJsonCredentialFile();
    if (!!jsonCredential && jsonCredential[key]){
      return jsonCredential[key];
    } else {
      return null;
    }
  };
  
  this.remove = async function (key) {
    if (!validateTokenCacheOption(key)) {
      return null;
    }
    const jsonCredential = await this.readJsonCredentialFile();
    
    if (jsonCredential && jsonCredential[key]) {
      try {
        jsonCredential[key] = null;
        await fs.writeFile(await this.getTokenDir(), JSON.stringify(jsonCredential), { mode: 0o600 });
      } catch (err) {
        throw new Error(`Failed to write token data from the file in ${await this.getTokenDir()}. Please check the permission or the file format of the token. ${err.message}`);
      } 
    }
  };

  function validateTokenCacheOption(key) {
    return Util.checkParametersDefined(key); 
  }
}

module.exports = JsonCredentialManager;