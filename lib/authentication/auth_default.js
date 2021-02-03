/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

function auth_default(connectionConfig)
{
  /**
   * Update JSON body with password.
   *
   * @param {JSON} body
   *
   * @returns {null}
   */
  this.updateBody = function (body)
  {
    body['data']['PASSWORD'] = connectionConfig.password;
  };

  this.authenticate = async function ()
  {
    return;
  };
}

module.exports = auth_default;
