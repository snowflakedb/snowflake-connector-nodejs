/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

var auth_default = require('./auth_default');
var auth_web = require('./auth_web');

var authenticationTypes =
{
  DEFAULT_AUTHENTICATOR: 'SNOWFLAKE', // default authenticator name
  EXTERNAL_BROWSER_AUTHENTICATOR: 'EXTERNALBROWSER'
};

exports.authenticationTypes = authenticationTypes;

/**
 * Returns the JSON body to be sent when connecting.
 *
 * @param {String} authenticator
 * @param {String} account
 * @param {String} username
 * @param {String} clientName
 * @param {String} clientVersion
 * @param {Object} clientEnv
 *
 * @returns {JSON}
 */
exports.formAuthJSON = function formAuthJSON(authenticator, account, username, clientName, clientVersion, clientEnv)
{
  var body =
  {
    data:
    {
      AUTHENTICATOR: authenticator,
      ACCOUNT_NAME: account,
      LOGIN_NAME: username,
      CLIENT_APP_ID: clientName,
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
    return new auth_web(connectionConfig.region,
      connectionConfig.account);
  }
  else
  {
    // Authenticator specified does not exist
    return new auth_default(connectionConfig);
  }
};
