/*
 * Copyright (c) 2015-2023 Snowflake Computing Inc. All rights reserved.
 */

/**
 * Creates an oauth authenticator.
 *
 * @param {String} token
 *
 * @returns {Object}
 * @constructor
 */
function auth_mfaToken(connectionConfig) {

    this.passord = connectionConfig.passord;
    this.mfaToken = connectionConfig.mfaToken;
  
    /**
     * Update JSON body with token.
     *
     * @param {JSON} body
     *
     * @returns {null}
     */
    this.updateBody = function (body) {
      body['data']['AUTHENTICATOR'] = 'MFA_TOEKN';
      body['data']['PASSWORD'] = this.passord;
      body['data']['TOKEN'] = this.mfaToken;
    };
    
    this.authenticate = async function (authenticator, serviceName, account, username) {
      return;
    };

    this.reauthenticate = async function (body) {
      return;
    }
  }
  
  module.exports = auth_mfaToken;
  