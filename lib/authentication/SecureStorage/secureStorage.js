/*
 * Copyright (c) 2015-2023 Snowflake Computing Inc. All rights reserved.
 */


/**
 * 
 * @param {String} host 
 * @param {String} user 
 * @param {String} credType 
 * @returns 
 */
function buildTemporaryCredentialName(host, user, credType) {
  return `{${host.toUpperCase()}}:{${user.toUpperCase()}}:{SF_NODE_JS_DRIVER}:{${credType}}}`;
}

async function writeCredential(host, user, credType, token){
  const keytar = require('keytar');
  await keytar.setPassword(host, buildTemporaryCredentialName(host, user, credType), token);
}

async function readCredential(host, user, credType) {
  const keytar = require('keytar');
  return await keytar.getPassword(host, buildTemporaryCredentialName(host, user, credType));
}

async function deleteCredential(host, user, credType) {
  const keytar = require('keytar');
  return await keytar.deletePassword(host, buildTemporaryCredentialName(host, user, credType));
}

module.exports = {  
  buildTemporaryCredentialName, 
  writeCredential,
  readCredential, 
  deleteCredential 
};