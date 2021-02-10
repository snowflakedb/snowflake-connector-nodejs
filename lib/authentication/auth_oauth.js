/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

/**
 * Creates an oauth authenticator.
 *
 * @param {String} token
 *
 * @returns {Object}
 * @constructor
 */
function auth_oauth(token)
{
  var token = token;

  /**
   * Update JSON body with token.
   *
   * @param {JSON} body
   *
   * @returns {null}
   */
  this.updateBody = function (body)
  {
    body['data']['TOKEN'] = token;
  };

  this.authenticate = function (authenticator, serviceName, account, username)
  {
    return;
  };
}

module.exports = auth_oauth;
