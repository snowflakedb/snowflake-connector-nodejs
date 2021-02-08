/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

/**
 * Creates a default authenticator.
 *
 * @param {String} password
 *
 * @returns {Object}
 * @constructor
 */
function auth_default(password)
{
  var password = password;

  /**
   * Update JSON body with password.
   *
   * @param {JSON} body
   *
   * @returns {null}
   */
  this.updateBody = function (body)
  {
    body['data']['PASSWORD'] = password;
  };

  this.authenticate = function (authenticator, serviceName, account, username)
  {
    return;
  };
}

module.exports = auth_default;
