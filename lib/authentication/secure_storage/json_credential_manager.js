/*
 * Copyright (c) 2015-2023 Snowflake Computing Inc. All rights reserved.
 */

const path = require('path');
const Logger = require('../../logger');
const fs = require('fs');
const os = require('os');
const Util = require('../../util');

function JsonCrednetialManager() {
  this.getTokenDir = function () {
    let tokenDir = process.env.SF_TEMPORARY_CREDENTIAL_CACHE_DIR;
    if (!Util.exists(tokenDir)) {
      tokenDir = os.homedir();
    }
    if (!Util.exists(tokenDir)) {
      Logger.getInstance().error(`Temporary credential cache directory is invalid, and the driver cannot use the default location(home). 
      Please assign the enviroment variable value SF_TEMPORARY_CREDENTIAL_CACHE_DIR to enable the default credential manager.`);
      return null; // fallback to TMP if user home doesn't exist.
    }
    const tokenCacheFile = path.join(tokenDir, 'temporary_credential.json');
    Logger.getInstance().info('Cache directory: ', tokenCacheFile);
    return tokenCacheFile;
  };

  this.tokenDir = this.getTokenDir();
  
  this.readJsonCredentialFile = function () {
    const cred = fs.readFileSync(this.tokenDir, 'utf8');
    try {
      return JSON.parse(cred);
    } catch (err) {
      return null;
    }
  };
  
  this.write = function (key, token) {
    if (!Util.checkParametersDefined(key) || !this.tokenDir) {
      return null;
    }
    let jsonCredential = null;
  
    if (fs.existsSync(this.tokenDir)){
      jsonCredential = this.readJsonCredentialFile() || {};
    } else {
      jsonCredential = {}; 
    }
    jsonCredential[key] = token;
   
    fs.writeFileSync(this.tokenDir, JSON.stringify(jsonCredential), 'utf8');
  };
  
  this.read = function (key) {
    if (!Util.checkParametersDefined(key) || !this.tokenDir) {
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
      Logger.getInstance().error('Failed to delete Credential: ', err.message);
    } 
  };
  
  this.remove = function (key) {
    if (!Util.checkParametersDefined(key) || !this.tokenDir) {
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
        fs.writeFileSync(this.tokenDir, JSON.stringify(jsonCredential), 'utf8');
      }
    } catch (err){
      Logger.getInstance().error('Failed to delete Credential: ', err.message);
    } 
  };
}

module.exports = JsonCrednetialManager;