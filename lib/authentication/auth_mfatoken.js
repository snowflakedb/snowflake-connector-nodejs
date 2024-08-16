/*
 * Copyright (c) 2015-2023 Snowflake Computing Inc. All rights reserved.
 */

/**
 * Creates a MFA token authenticator
 *
 * @param {String} token
 *
 * @returns {Object}
 * @constructor
 */
function AuthMFAToken(connectionConfig) {

  this.password = connectionConfig.password;
  this.mfaToken = connectionConfig.mfaToken;
  this.passcode = connectionConfig.getPasscode();
  
  /**
     * Update JSON body with token.
     *
     * @param {JSON} body
     *
     * @returns {null}
     */
  this.updateBody = function (body) {
    body['data']['AUTHENTICATOR'] = 'USERNAME_PASSWORD_MFA';
    body['data']['PASSWORD'] = this.password;
    body['data']['TOKEN'] = this.mfaToken;
    
    if (connectionConfig.getPasscodeInPassword()) {
      body['data']['EXT_AUTHN_DUO_METHOD'] = 'passcode';
    } else if (this.passcode) {
      body['data']['EXT_AUTHN_DUO_METHOD'] = 'passcode';
      body['data']['PASSCODE'] = this.passcode;
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
  
module.exports = AuthMFAToken;
  