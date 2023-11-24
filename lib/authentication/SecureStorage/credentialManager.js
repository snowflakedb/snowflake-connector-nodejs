/*
 * Copyright (c) 2015-2023 Snowflake Computing Inc. All rights reserved.
 */

const Logger = require('../../logger');
const secureStorage = require('./secureStorage');
const localStorage = require('./localStorage');

/**
 * 
 * @param {String} host 
 * @param {String} user 
 * @param {String} credType 
 * @returns 
 */
async function writeCredential(host, user, credType, token) {
  if (!token || token === '') {
    Logger.getInstance().debug('Token is not provided');
    return;
  } else {
    try {
      try {
        await secureStorage.writeCredential(host, user, credType, token);
      } catch (err) {
        Logger.getInstance().trace('Failed to save the token in the credential manager. The token will be saved on the the local machine');
        await localStorage.writeCredential();
      }
    } catch (err){
      Logger.getInstance().error('Failed to save Credential: ', err.message);
    } 
  }
}

async function readCredential(host, user, credType) {
  if (!host) {
    return null;
  }
  try {
    try {
      return await secureStorage.readCredential(host, user, credType);
    } catch (err) {
      Logger.getInstance().trace('Failed to read the token from the credential manager. Searching the token at ', dir);
      return localStorage.readCredential(host, user, credType);
    }
  } catch (err){
    Logger.getInstance().error('Failed to save Credential: ', err.message);
  } 
}

async function deleteCredential(host, user, credType) {
  try {
    try {
      await secureStorage.deleteCredential(host, user, credType);
    } catch (err) {
      await localStorage.deleteCredential(host, user, credType);
    }
  } catch (err){
    Logger.getInstance().error('Failed to save Credential: ', err.message);
  } 
}

module.exports = { 
  writeCredential,
  readCredential, 
  deleteCredential 
};