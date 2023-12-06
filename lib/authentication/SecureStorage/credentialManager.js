/*
 * Copyright (c) 2015-2023 Snowflake Computing Inc. All rights reserved.
 */

const Logger = require('../../logger');
const localStorage = require('./localStorage');

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

function write(host, user, credType, token) {
  if (checkForNull(host, user, credType, token)) {
    Logger.getInstance().debug('Token cannot be saved. One of the paramenters is null or undefined');
    return;
  } else {
    try {
      localStorage.writeCredential(host, user, credType, token);
    } catch (err){
      Logger.getInstance().error('Failed to save Credential: ', err.message);
    } 
  }
}

function read(host, user, credType) {
  if (checkForNull(host, user, credType)) {
    Logger.getInstance().debug('Token cannot be read. One of the paramenters is null or undefined');
    return null;
  } 
  try {
   return localStorage.readCredential(host, user, credType);
  } catch (err){
    Logger.getInstance().error('Failed to read Credential: ', err.message);
  } 
}

function remove(host, user, credType) {
  if (checkForNull(host, user, credType)) {
    Logger.getInstance().debug('Token cannot be deleted. One of the paramenters is null or undefined');
    return;
  } 
  try {
    localStorage.deleteCredential(host, user, credType);
  } catch (err){
    Logger.getInstance().error('Failed to delete Credential: ', err.message);
  } 
}

module.exports = {
  checkForNull,
  write,
  read, 
  remove, 
};