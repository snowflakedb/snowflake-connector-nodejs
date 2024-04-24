/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const path = require('path');
const Logger = require('../../logger');
const fs = require('fs');
const os = require('os');
const Util = require('../../util');

function JsonCredentialManager(credentialCacheDir) {

  this.userinfo = os.userInfo();

  this.getTokenDir = function () {
    let tokenDir = credentialCacheDir;
    if (!Util.exists(tokenDir)) {
      tokenDir = os.homedir();
    } else {
      Logger.getInstance().info(`The credential cache directory is configured by the user. The token will be saved at ${tokenDir}`);
    }

    if (!Util.exists(tokenDir)) {
      throw new Error(`Temporary credential cache directory is invalid, and the driver is unable to use the default location(home). 
      Please assign the enviroment variable value SF_TEMPORARY_CREDENTIAL_CACHE_DIR to enable the default credential manager.`);
    }

    const tokenCacheFile = path.join(tokenDir, 'temporary_credential.json');

    if (fs.existsSync(tokenCacheFile)) {
      const mode = fs.statSync(tokenCacheFile).mode;
      if (mode & (fs.constants.S_IRUSR | fs.constants.S_IWUSR)) {
        Logger.getInstance().info('Checked that the user has read and write permission');
      } else {
        throw new Error(`You do not have read permission to the credential file: ${tokenCacheFile}.`);
      }
    }
    Logger.getInstance().info('Cache directory: ', tokenCacheFile);
    return tokenCacheFile;
  };

  this.tokenDir = this.getTokenDir();

  this.readJsonCredentialFile = function () {
    try {
      const cred = fs.readFileSync(this.tokenDir, 'utf8');
      return JSON.parse(cred);
    } catch (err) {
      Logger.getInstance().info(`Cannot read token data from the file in ${this.tokenDir}. Please check the permission or the file format of the token.`);
      return null;
    }
  };
  
  this.write = function (key, token) {
    if (!validateTokenCacheOption(key)) {
      return null;
    }
    
    let jsonCredential = null;
  
    if (fs.existsSync(this.tokenDir)){
      jsonCredential = this.readJsonCredentialFile() || {};
    } else {
      jsonCredential = {}; 
    }
    jsonCredential[key] = token;
   
    try {
      fs.writeFileSync(this.tokenDir, JSON.stringify(jsonCredential), { mode: fs.constants.S_IRUSR | fs.constants.S_IWUSR });
    } catch (err) {
      Logger.getInstance().info(`Cannot write token data from the file in ${this.tokenDir}. Please check the permission or the file format of the token. ${err.message}`);
      return null;
    }
  };
  
  this.read = function (key) {
    if (!validateTokenCacheOption(key)) {
      return null;
    }

    try {
      if (!fs.existsSync(this.tokenDir)){
        Logger.getInstance().info('Cannot find the credential file from the directory');
        return null;
      }
      const jsonCredential = this.readJsonCredentialFile();
      return jsonCredential[key] || null;
    } catch (err){
      Logger.getInstance().error('Failed to read Credential or Permission is denied: ', err.message);
    } 
  };
  
  this.remove = function (key) {
    if (!validateTokenCacheOption(key)) {
      return null;
    }

    try {
      if (!fs.existsSync(this.tokenDir)){
        Logger.getInstance().info('Cannot find the credential file from the directory');
        return null;
      }
      const jsonCredential = this.readJsonCredentialFile();
    
      if (jsonCredential[key]) {
        jsonCredential[key] = null;
        fs.writeFileSync(this.tokenDir, JSON.stringify(jsonCredential), { mode: fs.constants.S_IRUSR | fs.constants.S_IWUSR });
      }
    } catch (err) {
      Logger.getInstance().error('Failed to delete Credential from the cache file: ', err.message);
    } 
  };

  function validateTokenCacheOption(key) {
    return Util.checkParametersDefined(key); 
  }
}

module.exports = JsonCredentialManager;