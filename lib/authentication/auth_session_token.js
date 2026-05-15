/**
 * Creates a session token authenticator.
 *
 * This authenticator is used when pre-existing session and master tokens are
 * supplied directly (e.g. from a connections.toml file written by Cortex Code
 * Desktop or obtained from another SDK). No login request is needed because the
 * tokens are already valid.
 *
 * @param {Object} connectionConfig
 *
 * @returns {Object}
 * @constructor
 */
function AuthSessionToken(connectionConfig) {
  if (!connectionConfig || !connectionConfig.sessionToken) {
    throw new Error(
      'SESSION_TOKEN authenticator requires a sessionToken to be provided in the connection options.',
    );
  }

  /**
   * No-op: the login body is not sent when session tokens are pre-supplied.
   */
  this.updateBody = function () {
    // Nothing to add; the connection will skip the login request entirely
    // and use the pre-existing tokens from TokenInfo.
  };

  /**
   * No-op: tokens are already available, no authentication flow is needed.
   */
  this.authenticate = async function () {};
}

module.exports = AuthSessionToken;
