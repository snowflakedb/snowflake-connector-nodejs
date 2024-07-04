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
  };
    
  this.authenticate = async function () {
    return;
  };

  this.reauthenticate = async function () {
    return;
  };
}
  
module.exports = AuthMFAToken;
  