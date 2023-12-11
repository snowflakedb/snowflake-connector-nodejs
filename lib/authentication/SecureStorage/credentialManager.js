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

function write(key, token) {
  if (checkForNull(key)) {
    return;
  }
  try {
    localStorage.writeCredential(key, token);
  } catch (err){
    Logger.getInstance().error('Failed to save Credential: ', err.message);
  } 
}

function read(key) {
  if (checkForNull(key)) {
    return null;
  }
  try {
    return localStorage.readCredential(key);
  } catch (err){
    Logger.getInstance().error('Failed to read Credential: ', err.message);
  } 
}

function remove(key) {
  if (checkForNull(key)) {
    return;
  }
  try {
    localStorage.deleteCredential(key);
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