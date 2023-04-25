/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

var auth_default = require('./auth_default');
var auth_web = require('./auth_web');
var auth_keypair = require('./auth_keypair');
var auth_oauth = require('./auth_oauth');
var auth_okta = require('./auth_okta');

var authenticationTypes =
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
)
{
  var body =
  {
    data:
    {
      AUTHENTICATOR: authenticator,
      ACCOUNT_NAME: account,
      LOGIN_NAME: username,
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

  return body;
};

/**
 * Returns the authenticator to use base on the connection configuration.
 *
 * @param {Object} connectionConfig
 *
 * @returns {Object} the authenticator.
 */
exports.getAuthenticator = function getAuthenticator(connectionConfig)
{
  var auth = connectionConfig.getAuthenticator();

  if (auth == authenticationTypes.DEFAULT_AUTHENTICATOR)
  {
    return new auth_default(connectionConfig.password);
  }
  else if (auth == authenticationTypes.EXTERNAL_BROWSER_AUTHENTICATOR)
  {
    return new auth_web(connectionConfig.host);
  }
  if (auth == authenticationTypes.KEY_PAIR_AUTHENTICATOR)
  {
    return new auth_keypair(connectionConfig.getPrivateKey(),
      connectionConfig.getPrivateKeyPath(),
      connectionConfig.getPrivateKeyPass());
  }
  else if (auth == authenticationTypes.OAUTH_AUTHENTICATOR)
  {
    return new auth_oauth(connectionConfig.getToken());
  }
  else if (auth.startsWith('HTTPS://'))
  {
    return new auth_okta(connectionConfig.password,
      connectionConfig.region,
      connectionConfig.account,
      connectionConfig.getClientType(),
      connectionConfig.getClientVersion()
    );
  }
  else
  {
    // Authenticator specified does not exist
    return new auth_default(connectionConfig.password);
  }
};
