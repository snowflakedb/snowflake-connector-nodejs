/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

/**
 * Creates a default authenticator.
 *
 * @param {String} password
 *
 * @returns {Object}
 * @constructor
 */
function AuthDefault(password) {
  /**
   * Update JSON body with password.
   *
   * @param {JSON} body
   *
   * @returns {null}
   */
  this.updateBody = function (body) {
    body['data']['PASSWORD'] = password;
  };

  this.authenticate = async function () {};
}

module.exports = AuthDefault;
