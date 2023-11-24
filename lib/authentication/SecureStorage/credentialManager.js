/*
 * Copyright (c) 2015-2023 Snowflake Computing Inc. All rights reserved.
 */

const Logger = require('../../logger');
const secureStorage = require('./secureStorage');
const localStorage = require('./localStorage');
const os = require('os');

/**
 * 
 * @param {String} host 
 * @param {String} user 
 * @param {String} credType 
 * @returns 
 */

function checkForNull(...parameters){
  return parameters.some((element) => element === undefined || element === null);
}

function isLinuxMachine() {
  return os.platform() !== 'win32' || os.platform() !== 'darwin';
}

async function writeCredential(host, user, credType, token) {
  if (checkForNull(host, user, credType, token)) {
    Logger.getInstance().debug('Token cannot be saved. One of the paramenters is null or undefined');
    return;
  } else {
    try {
      isLinuxMachine() ? await localStorage.writeCredential(host, user, credType, token) :
        await secureStorage.writeCredential(host, user, credType, token);
    } catch (err){
      Logger.getInstance().error('Failed to save Credential: ', err.message);
    } 
  }
}

async function readCredential(host, user, credType) {
  if (checkForNull(host, user, credType)) {
    Logger.getInstance().debug('Token cannot be read. One of the paramenters is null or undefined');
    return null;
  } 
  try {
    return isLinuxMachine() ?  await localStorage.readCredential(host, user, credType) :
      await secureStorage.readCredential(host, user, credType);
  } catch (err){
    Logger.getInstance().error('Failed to read Credential: ', err.message);
  } 
}

async function deleteCredential(host, user, credType) {
  if (checkForNull(host, user, credType)) {
    Logger.getInstance().debug('Token cannot be deleted. One of the paramenters is null or undefined');
    return;
  } 
  try {
    isLinuxMachine() ? await localStorage.deleteCredential(host, user, credType) :
      await secureStorage.deleteCredential(host, user, credType);
  } catch (err){
    Logger.getInstance().error('Failed to delete Credential: ', err.message);
  } 
}

module.exports = {
  checkForNull,
  writeCredential,
  readCredential, 
  deleteCredential 
};