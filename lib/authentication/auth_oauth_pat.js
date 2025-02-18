/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const Util = require('../util');
/**
 * Creates an oauth authenticator.
 *
 * @param {String} token
 *
 * @returns {Object}
 * @constructor
 */
function AuthOauthPAT(token, password) {
  /**
   * Update JSON body with token.
   *
   * @param {JSON} body
   *
   * @returns {null}
   */
  this.updateBody = function (body) {
    if (Util.exists(token)) {
      body['data']['TOKEN'] = token;
    } else if (Util.exists(password)) {
      body['data']['TOKEN'] = password;
    }
  };

  this.authenticate = async function () {};
}
module.exports = AuthOauthPAT;
