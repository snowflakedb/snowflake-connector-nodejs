/*
 * Copyright (c) 2015-2023 Snowflake Computing Inc. All rights reserved.
 */

const auth_web = require('./auth_web');

/**
 * Creates an oauth authenticator.
 *
 * @param {String} token
 *
 * @returns {Object}
 * @constructor
 */
function auth_idToken(connectionConfig, httpClient) {

  this.idToken = connectionConfig.idToken;

  /**
   * Update JSON body with token.
   *
   * @param {JSON} body
   *
   * @returns {null}
   */
  this.updateBody = function (body) {
    body['data']['TOKEN'] = this.idToken;
    body['data']['AUTHENTICATOR'] = 'ID_TOKEN';
  };

  this.resetSecret = function () {
    this.idToken = null;
  };
  
  this.authenticate = async function (authenticator, serviceName, account, username) {
    return;
  };

  this.reauthenticate = async function (body) {
    const auth = new auth_web(connectionConfig, httpClient);
    await auth.authenticate(connectionConfig.getAuthenticator(),
      connectionConfig.getServiceName(),
      connectionConfig.account,
      connectionConfig.username);
    auth.updateBody(body);
  };
}

module.exports = auth_idToken;
