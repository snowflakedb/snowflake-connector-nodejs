
const path = require('path');
const GlobalConfig = require('../global_config');
const Logger = require('../logger');
const keytar = require('keytar');
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
 * @param {String} cred_type 
 * @returns 
 */

function buildTemporaryCredentialName(host, user, cred_type, number) {
  return `{${host.toUpperCase()}}:{${user.toUpperCase()}}:{SF_NODE_JS_DRIVER}:{${cred_type}}:{${number}}`;
}

async function writeCredential(host, user, credType, token){
  if (!token || token == '') {
    Logger.getInstance().debug('Token is not provided');
  } else {
    try {
      const tokenArr = splitToken(token);
      for (const i in tokenArr){
        await keytar.setPassword(host, buildTemporaryCredentialName(host, user, credType, i), tokenArr[i]);
      }
    } 
    catch (err){
      Logger.getInstance().error('Failed to save Credential: ', err.message);
    }
      
    
  }
}

async function readCredential(host, user, credType) {
  let token = '';
  for (let i = 0; ; i++) {
    const result = await keytar.getPassword(host, buildTemporaryCredentialName(host, user, credType, i));
    if (result) {
      token += result
    } else {
      break;
    }
  }
  // return token.length === 0? null : token.replace(/['"]+/g, '');
  return token.length === 0? null : token;

}

async function deleteCredential(host, user, credType) {
  for (let i = 0; ;i++ ) {
    const result = await keytar.deletePassword(host, buildTemporaryCredentialName(host, user, credType, i));
    if (!result) {
      break;
    }
  }
}

function splitToken(token) {
  const MAX_LENGTH = 2500;
  const numofSplit = token.length % MAX_LENGTH !== 0 ?  token.length / MAX_LENGTH : (token.length / MAX_LENGTH) - 1;
  let tokenArr = [];
  
  for (let i = 0; i <= numofSplit; i++) {
    let endPoint = (i+1) * MAX_LENGTH;
    if (token.length < endPoint){
      endPoint = token.length;
    }
    tokenArr.push(token.slice(i * MAX_LENGTH, endPoint));
  }
  return tokenArr;
}

module.exports = { 
  createCredentialCacheDir, 
  buildTemporaryCredentialName, 
  writeCredential,
  readCredential, 
  deleteCredential 
};