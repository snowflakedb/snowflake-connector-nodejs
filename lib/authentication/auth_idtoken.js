/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const AuthWeb = require('./auth_web');

/**
 * Creates an ID token authenticator.
 *
 * @param {Object} connectionConfig
 * @param {Object} httpClient
 * @param {module} webbrowser
 *
 * @returns {Object} the authenticator
 * @constructor
 */
function AuthIDToken(connectionConfig, httpClient, externalBrowserCallback) {

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
  
  this.authenticate = async function () {};

  this.reauthenticate = async function (body) {
    const auth = new AuthWeb(connectionConfig, httpClient, externalBrowserCallback);
    await auth.authenticate(connectionConfig.getAuthenticator(),
      connectionConfig.getServiceName(),
      connectionConfig.account,
      connectionConfig.username);
    auth.updateBody(body);
  };
}

module.exports = AuthIDToken;
