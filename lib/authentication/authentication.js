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
 * @param {Object} connectionConfig
 *
 * @returns {JSON}
 */
exports.formAuthJSON = function formAuthJSON(connectionConfig)
{
  var body =
  {
    data:
    {
      AUTHENTICATOR: connectionConfig.getAuthenticator(),
      ACCOUNT_NAME: connectionConfig.account,
      LOGIN_NAME: connectionConfig.username,
      CLIENT_APP_ID: connectionConfig.getClientName(),
      CLIENT_APP_VERSION: connectionConfig.getClientVersion(),
      CLIENT_ENVIRONMENT:
      {
        OS: connectionConfig.getClientEnvironment().OS,
        OS_VERSION: connectionConfig.getClientEnvironment().OS_VERSION,
        OCSP_MODE: connectionConfig.getClientEnvironment().OCSP_MODE
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
    return new auth_default(connectionConfig);
  }
  else if (auth == authenticationTypes.EXTERNAL_BROWSER_AUTHENTICATOR)
  {
    return new auth_web(connectionConfig);
  }
  else
  {
    // Authenticator specified does not exist
    return new auth_default(connectionConfig);
  }
};
