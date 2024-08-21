/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

/**
 * Creates a default authenticator.
 *
 * @param {String} password
 *
 * @returns {Object}
 * @constructor
 */
function AuthDefault(connectionConfig) {
  const password = connectionConfig.password;
  const mfaToken = connectionConfig.mfaToken;
  const passcode = connectionConfig.getPasscode();
  
  /**
     * Update JSON body with password or token.
     *
     * @param {JSON} body
     *
     * @returns {null}
     */
  this.updateBody = function (body) {
    body['data']['PASSWORD'] = password;
    body['data']['TOKEN'] = mfaToken;
    
    if (connectionConfig.getPasscodeInPassword()) {
      body['data']['EXT_AUTHN_DUO_METHOD'] = 'passcode';
    } else if (passcode) {
      body['data']['EXT_AUTHN_DUO_METHOD'] = 'passcode';
      body['data']['PASSCODE'] = passcode;
    } else {
      body['data']['EXT_AUTHN_DUO_METHOD'] = 'push';
    }
  };
    
  this.authenticate = async function () {
    return;
  };

  this.reauthenticate = async function () {
    return;
  };
}

module.exports = AuthDefault;
