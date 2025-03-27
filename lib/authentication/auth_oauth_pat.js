const Util = require('../util');
const AuthenticationTypes = require('./authentication_types');
/**
 * Creates an oauth PAT  authenticator.
 *
 * @param {String} token
 * @param {String} password
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
    body['data']['AUTHENTICATOR'] = AuthenticationTypes.OAUTH_AUTHENTICATOR;
    body['data']['OAUTH_TYPE'] = AuthenticationTypes.PROGRAMMATIC_ACCESS_TOKEN;
  };

  this.authenticate = async function () {};
}
module.exports = AuthOauthPAT;
