const AuthWeb = require('./auth_web');
const { buildCacheKey, CacheTokenTypes } = require('./cache_key_builder');
const GlobalConfig = require('../global_config');

/**
 * Creates an ID token authenticator.
 *
 * @param {Object} connectionConfig
 * @param {Object} httpClient
 *
 * @returns {Object} the authenticator
 * @constructor
 */
function AuthIDToken(connectionConfig, httpClient) {
  this.idToken = connectionConfig.idToken;

  /**
   * Update JSON body with token.
   *
   * @param {JSON} body
   *
   * @returns {null}
   */
  this.updateBody = function (body) {
    body['data']['TOKEN'] = this.idToken;
    body['data']['AUTHENTICATOR'] = 'ID_TOKEN';
  };

  this.authenticate = async function () {};

  this.reauthenticate = async function (body) {
    if (connectionConfig.username) {
      const key = buildCacheKey({
        tokenType: CacheTokenTypes.ID_TOKEN,
        idp: connectionConfig.host,
        snowflake: connectionConfig.host,
        username: connectionConfig.username,
        role: connectionConfig.getRole() || '',
      });
      await GlobalConfig.getCredentialManager().remove(key);
    }
    const auth = new AuthWeb(connectionConfig, httpClient);
    await auth.authenticate();
    auth.updateBody(body);
  };
}

module.exports = AuthIDToken;
