/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

const AuthDefault = require('./auth_default');
const AuthWeb = require('./auth_web');
const AuthKeypair = require('./auth_keypair');
const AuthOauth = require('./auth_oauth');
const AuthOkta = require('./auth_okta');
const Logger = require('../logger');

let authenticator;

const authenticationTypes =
{
  DEFAULT_AUTHENTICATOR: 'SNOWFLAKE', // default authenticator name
  EXTERNAL_BROWSER_AUTHENTICATOR: 'EXTERNALBROWSER',
  KEY_PAIR_AUTHENTICATOR: 'SNOWFLAKE_JWT',
  OAUTH_AUTHENTICATOR: 'OAUTH',
};

exports.authenticationTypes = authenticationTypes;

/**
 * Returns the JSON body to be sent when connecting.
 *
 * @param {String} authenticator
 * @param {String} account
 * @param {String} username
 * @param {String} clientType
 * @param {String} clientVersion
 * @param {Object} clientEnv
 *
 * @returns {JSON}
 */
exports.formAuthJSON = function formAuthJSON(
  authenticator,
  account,
  username,
  clientType,
  clientVersion,
  clientEnv
) {
  const body = {
    data: {
      ACCOUNT_NAME: account,
      CLIENT_APP_ID: clientType,
      CLIENT_APP_VERSION: clientVersion,
      CLIENT_ENVIRONMENT:
        {
          OS: clientEnv.OS,
          OS_VERSION: clientEnv.OS_VERSION,
          OCSP_MODE: clientEnv.OCSP_MODE
        }
    }
  };
  if (!this.isOktaAuth(authenticator)) {
    body['data']['AUTHENTICATOR'] = authenticator;
    body['data']['LOGIN_NAME'] = username;
  }

  return body;
};

/**
 * Returns the authenticator to use base on the connection configuration.
 *
 * @param {Object} connectionConfig
 * @param httpClient
 *
 * @returns {Object} the authenticator.
 */
exports.getAuthenticator = function getAuthenticator(connectionConfig, httpClient) {
  const authType = connectionConfig.getAuthenticator();
  let auth;
  if (authType === authenticationTypes.DEFAULT_AUTHENTICATOR) {
    auth = new AuthDefault(connectionConfig.password);
  } else if (authType === authenticationTypes.EXTERNAL_BROWSER_AUTHENTICATOR) {
    auth = new AuthWeb(connectionConfig, httpClient);
  } else if (authType === authenticationTypes.KEY_PAIR_AUTHENTICATOR) {
    auth = new AuthKeypair(connectionConfig.getPrivateKey(),
      connectionConfig.getPrivateKeyPath(),
      connectionConfig.getPrivateKeyPass());
  } else if (authType === authenticationTypes.OAUTH_AUTHENTICATOR) {
    auth = new AuthOauth(connectionConfig.getToken());
  } else if (this.isOktaAuth(authType)) {
    auth = new AuthOkta(connectionConfig, httpClient);
  } else {
    // Authenticator specified does not exist
    Logger.getInstance().warn(`No authenticator found for '${authType}'. Using default authenticator as a fallback`);
    auth = new AuthDefault(connectionConfig.password);
  }

  authenticator = auth;
  return auth;
};

/**
 * Returns the boolean describing if the provided authenticator is okta or not.
 *
 * @param {String} authenticator
 * @returns {boolean}
 */
exports.isOktaAuth = function isOktaAuth(authenticator) {
  return authenticator.toUpperCase().startsWith('HTTPS://');
};

exports.getCurrentAuth = function () {
  return authenticator;
};
