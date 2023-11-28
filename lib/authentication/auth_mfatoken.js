/*
 * Copyright (c) 2015-2023 Snowflake Computing Inc. All rights reserved.
 */

const auth_okta = require('./auth_okta');

/**
 * Creates an oauth authenticator.
 *
 * @param {String} token
 *
 * @returns {Object}
 * @constructor
 */
function auth_mfaToken(connectionConfig) {

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

    if (this.mfaToken) {
      body['data']['TOKEN'] = this.mfaToken;
    }
  };
    
  this.authenticate = async function (authenticator, serviceName, account, username) {
    return;
  };

  this.reauthenticate = async function (body) {
    return;
  }
}
  
module.exports = auth_mfaToken;
  