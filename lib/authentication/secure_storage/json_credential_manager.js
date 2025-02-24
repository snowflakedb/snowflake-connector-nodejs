const path = require('path');
const Logger = require('../../logger');
const fs = require('node:fs/promises');
const os = require('os');
const Util = require('../../util');
const { validateOnlyUserReadWritePermissionAndOwner } = require('../../file_util');

function JsonCredentialManager(credentialCacheDir) {
  
  this.getTokenDir = async function () {
    let tokenDir = credentialCacheDir;
    if (!Util.exists(tokenDir)) {
      tokenDir = os.homedir();
    } else {
      Logger.getInstance().info(`The credential cache directory is configured by the user. The token will be saved at ${tokenDir}`);
    }

    if (!Util.exists(tokenDir)) {
      throw new Error(`Temporary credential cache directory is invalid, and the driver is unable to use the default location(home). 
      Please set 'credentialCacheDir' connection configuration option to enable the default credential manager.`);
    }

    const tokenCacheFile = path.join(tokenDir, 'temporary_credential.json');
    await validateOnlyUserReadWritePermissionAndOwner(tokenCacheFile);
    return tokenCacheFile;
  };
   
  this.readJsonCredentialFile = async function () {
    try {
      const cred = await fs.readFile(await this.getTokenDir(), 'utf8');
      return JSON.parse(cred);
    } catch (err) {
      Logger.getInstance().warn('Failed to read token data from the file. Err: %s', err.message);
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