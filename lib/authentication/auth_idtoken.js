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
function auth_idToken(id_token) {

  this.id_token = id_token;

  /**
   * Update JSON body with token.
   *
   * @param {JSON} body
   *
   * @returns {null}
   */
  this.updateBody = function (body) {
    body['data']['TOKEN'] = this.id_token;
    body['data']['AUTHENTICATOR'] = 'ID_TOKEN'
  };

  this.resetSecret = function () {
    this.id_token = null;
  };
  
  this.authenticate = async function (authenticator, serviceName, account, username) {
    return;
  };
}

module.exports = auth_idToken;
