/*
 * Copyright (c) 2015-2023 Snowflake Computing Inc. All rights reserved.
 */

const Logger = require('../../logger');

/**
 * 
 * @param {String} host 
 * @param {String} user 
 * @param {String} credType 
 * @returns 
 */
function buildTemporaryCredentialName(host, user, credType) {
  return `{${host.toUpperCase()}}:{${user.toUpperCase()}}:{SF_NODE_JS_DRIVER}:{${credType.toUpperCase()}}}`;
}

async function writeCredential(host, user, credType, token){
  try {
    const keytar = require('keytar');
    await keytar.setPassword(host, buildTemporaryCredentialName(host, user, credType), token);
  } catch (err) {
    Logger.getInstance().debug(`Node moodule 'keytar' is not installed, cannot cache token. You might experience
    multiple authentication pop ups or mfa requests. To avoid 
    this please install keyring module using the following command : npm install keytar`);
    return null;
  }
}

async function readCredential(host, user, credType) {
  try {
    const keytar = require('keytar');
    return await keytar.getPassword(host, buildTemporaryCredentialName(host, user, credType));
  } catch (err) {
    Logger.getInstance().debug(`Node moodule 'keytar' is not installed, cannot cache token. You might experience
    multiple authentication pop ups or mfa requests. To avoid 
    this please install keyring module using the following command : npm install keytar` );
    return null;
  }
}

async function deleteCredential(host, user, credType) {
  try {
    const keytar = require('keytar');
    return await keytar.deletePassword(host, buildTemporaryCredentialName(host, user, credType));
  } catch (err) {
    Logger.getInstance().debug(`Node moodule 'keytar' is not installed, cannot cache token. You might experience
    multiple authentication pop ups or mfa requests. To avoid 
    this please install keyring module using the following command : npm install keytar`);
    return null;
  }
}

module.exports = {  
  buildTemporaryCredentialName, 
  writeCredential,
  readCredential, 
  deleteCredential 
};