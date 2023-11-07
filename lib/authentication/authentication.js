/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

const auth_default = require('./auth_default');
const auth_web = require('./auth_web');
const auth_keypair = require('./auth_keypair');
const auth_oauth = require('./auth_oauth');
const auth_okta = require('./auth_okta');

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
  const auth = connectionConfig.getAuthenticator();

  if (auth === authenticationTypes.DEFAULT_AUTHENTICATOR) {
    return new auth_default(connectionConfig.password);
  } else if (auth === authenticationTypes.EXTERNAL_BROWSER_AUTHENTICATOR) {
    return new auth_web(connectionConfig, httpClient);
  }
  if (auth === authenticationTypes.KEY_PAIR_AUTHENTICATOR) {
    return new auth_keypair(connectionConfig.getPrivateKey(),
      connectionConfig.getPrivateKeyPath(),
      connectionConfig.getPrivateKeyPass());
  } else if (auth === authenticationTypes.OAUTH_AUTHENTICATOR) {
    return new auth_oauth(connectionConfig.getToken());
  } else if (this.isOktaAuth(auth)) {
    return new auth_okta(connectionConfig.password,
      connectionConfig.region,
      connectionConfig.account,
      connectionConfig.getClientType(),
      connectionConfig.getClientVersion(),
      httpClient
    );
  } else {
    // Authenticator specified does not exist
    return new auth_default(connectionConfig.password);
  }
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
