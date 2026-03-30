const util = require('../util');
const querystring = require('querystring');
const URLUtil = require('./../../lib/url_util');
const Util = require('./../../lib/util');
const SsoUrlProvider = require('../authentication/sso_url_provider');
const crypto = require('crypto');
const { rest } = require('../global_config');
const { createServer } = require('./authentication_util');
const { withBrowserActionTimeout } = require('./authentication_util');
const { coordinateAuth } = require('./auth_coordinator');
const AuthenticationTypes = require('./authentication_types');

/**
 * Creates an external browser authenticator.
 *
 * @param {Object} connectionConfig
 * @param {Object} httpClient
 *
 * @returns {Object}
 * @constructor
 */
function AuthWeb(connectionConfig, httpClient) {
  const host = connectionConfig.host;
  const browserRedirectPort = connectionConfig.browserRedirectPort;
  const browserActionTimeout = connectionConfig.getBrowserActionTimeout();
  const ssoUrlProvider = new SsoUrlProvider(httpClient);

  if (!Util.exists(host)) {
    throw new Error(`Invalid value for host: ${host}`);
  }
  if (!Util.number.isPositiveInteger(browserActionTimeout)) {
    throw new Error(`Invalid value for browser action timeout: ${browserActionTimeout}`);
  }

  const open = connectionConfig.openExternalBrowserCallback || require('open');

  let proofKey;
  let token;

  /**
   * Update JSON body with token and proof_key.
   *
   * @param {JSON} body
   *
   * @returns {null}
   */
  this.updateBody = function (body) {
    body['data']['TOKEN'] = token;
    body['data']['PROOF_KEY'] = proofKey;
    body['data']['AUTHENTICATOR'] = 'EXTERNALBROWSER';
  };

  /**
   * Obtain SAML token through SSO URL.
   *
   * @param {String} authenticator
   * @param {String} serviceName
   * @param {String} account
   * @param {String} username
   *
   * @returns {Promise<null>}
   */
  this.authenticate = async function (authenticator, serviceName, account, username) {
    const result = await coordinateAuth(
      host,
      username,
      AuthenticationTypes.EXTERNAL_BROWSER_AUTHENTICATOR,
      async () => {
        let server;
        let loginUrl;
        let localProofKey;

        const receiveData = new Promise((resolve) => {
          server = createServer(resolve);
        }).then((result) => {
          return result;
        });

        try {
          await new Promise((resolve, reject) => {
            server.listen(browserRedirectPort);
            server.on('listening', () => resolve(server.address()));
            server.on('error', reject);
          });
        } catch (err) {
          throw new Error(
            `Error while creating local server on port ${browserRedirectPort}: ${err}`,
          );
        }

        try {
          if (connectionConfig.getDisableConsoleLogin()) {
            const ssoData = await ssoUrlProvider.getSSOURL(
              authenticator,
              serviceName,
              account,
              server.address().port,
              username,
              host,
            );

            localProofKey = ssoData['proofKey'];
            loginUrl = ssoData['ssoUrl'];
          } else {
            localProofKey = generateProofKey();
            loginUrl = getLoginUrl(username, localProofKey, server.address().port);
          }

          if (!URLUtil.isValidURL(loginUrl)) {
            throw new Error(util.format('Invalid SSO URL found - %s ', loginUrl));
          }

          open(loginUrl);

          const tokenGetHttpLine = await withBrowserActionTimeout(
            browserActionTimeout,
            receiveData,
          ).catch((rejected) => {
            throw new Error(util.format('Error while getting SAML token: %s', rejected));
          });
          const localToken = parseToken(tokenGetHttpLine);
          return JSON.stringify({ token: localToken, proofKey: localProofKey });
        } catch (err) {
          server.close();
          throw err;
        }
      },
    );

    const parsed = JSON.parse(result);
    token = parsed.token;
    proofKey = parsed.proofKey;
  };

  function generateProofKey() {
    const randomness = crypto.randomBytes(32);
    return Buffer.from(randomness, 'utf8').toString('base64');
  }

  this.generateProofKey = generateProofKey;

  function getLoginUrl(username, proofKey, port) {
    const url = new URL(rest.HTTPS_PROTOCOL + '://' + host + '/console/login');
    url.searchParams.append('login_name', username);
    url.searchParams.append('proof_key', proofKey);
    url.searchParams.append('browser_mode_redirect_port', port);
    return url.toString();
  }

  this.getLoginUrl = getLoginUrl;

  function parseToken(tokenHttpGetLine) {
    const data = tokenHttpGetLine.split(' ');
    return querystring.parse(data[1])['/?token'];
  }
}

module.exports = AuthWeb;
