const Logger = require('./../logger');
const authUtil = require('../authentication/authentication_util');
const { getFreePort, exists, format } = require('../util');
const { withBrowserActionTimeout } = require('./authentication_util');
const querystring = require('querystring');
const GlobalConfig = require('../global_config');
const open = require('open');

/**
 * Creates an oauth authenticator.
 *
 * @param {String} token
 *
 * @returns {Object}
 * @constructor
 */
function AuthOauthAuthorizationCode(connectionConfig, httpClient) {
  const SNOWFLAKE_AUTHORIZE_ENDPOINT = '/oauth/authorize';
  const SNOWFLAKE_TOKEN_REQUEST_ENDPOINT = '/oauth/token-request';
  const DEFAULT_REDIRECT_HOST = 'http://127.0.0.1';
  const DEFAULT_REDIRECT_URI_ENDPOINT = '/';
  const browserActionTimeout = connectionConfig.getBrowserActionTimeout();

  let oauth;
  let token;
  /**
         * Update JSON body with token.
         * @param {JSON} body
         * @returns {null}
         */
  this.updateBody = function (body) {
    if (exists(token)) {
      body['data']['TOKEN'] = token;
    }
  };

  this.loadOauth4webapi =  async function () {
    if (!oauth) {
      oauth = await import('oauth4webapi');
    }
  };

  this.authenticate = async function () {
    globalThis.crypto ??= require('node:crypto').webcrypto;
    await this.loadOauth4webapi(); // import module using the dynamic import
    const codeChallengeMethod = 'S256';
    const codeVerifier = oauth.generateRandomCodeVerifier();
    const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
    const as = { issuer: 'snowflakecomputing.com' };
    const clientId = connectionConfig.getOauthClientId();  // Client ID
    const clientSecret = connectionConfig.getOauthClientSecret();  // Client Secret
    const client = { client_id: clientId };
    const clientAuth = oauth.ClientSecretPost(clientSecret);
    const redirectPort = await getFreePort();
    const redirectUri = await buildRedirectUri(connectionConfig, redirectPort);

    const authorizationUrl = prepareAuthorizationUrl(client, redirectUri, codeChallenge, codeChallengeMethod, as);

    const authorizationCodeResponse = await requestAutorizationCode(authorizationUrl, browserActionTimeout);
    const params = oauth.validateAuthResponse(as, client, authorizationUrl, authorizationCodeResponse.state);

    const tokenUrl = getTokenUrl(connectionConfig);
    params.set('code', authorizationCodeResponse. code);
    Logger.getInstance().trace('Requesting token');
    token = await requestToken(as, tokenUrl, client, clientAuth, params, redirectUri, codeVerifier);
  };

  function prepareAuthorizationUrl(client, redirectUri, codeChallenge, codeChallengeMethod, as, state) {
    const authorizationUrl = getAuthorizationUrl(connectionConfig);
    authorizationUrl.searchParams.set('client_id', client.client_id);
    authorizationUrl.searchParams.set('redirect_uri', redirectUri);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('scope', 'session:role:ANALYST');
    authorizationUrl.searchParams.set('code_challenge', codeChallenge);
    authorizationUrl.searchParams.set('code_challenge_method', codeChallengeMethod);

    /**
     * We cannot be sure the AS supports PKCE so we're going to use state too. Use of PKCE is
     * backwards compatible even if the AS doesn't support it which is why we're using it regardless.
     */
    if (as.code_challenge_methods_supported?.includes('S256') !== true) {
      state = oauth.generateRandomState();
      authorizationUrl.searchParams.set('state', state);
    }
    return authorizationUrl;
  }

  async function requestAutorizationCode(authorizationUrl, browserActionTimeout) {
    let server;
    const receiveData = new Promise((resolve, reject) => {
      server = authUtil.createServer(resolve, reject);
    }).then((result) => {
      return result;
    });

    const redirectUri = new URL(authorizationUrl.searchParams.get('redirect_uri'));
    server.listen(redirectUri.port || 0, 0);

    const authorizationCodeProvider = GlobalConfig.getCustomRedirectingClient();
    const codeProvider = authorizationCodeProvider ? authorizationCodeProvider : browserAuthorizationCodeProvider;

    await codeProvider(authorizationUrl);

    const codeResponse = await withBrowserActionTimeout(browserActionTimeout, receiveData).catch((rejected) => {
      server.close();
      const errorResponse = querystring.parse(rejected.substring(rejected.indexOf('?') + 1));
      const error = errorResponse['error'];
      const errorDescription = errorResponse['error_description'].replace(new RegExp( '\\sHTTP/.*'), '');
      throw new Error(format('Error while getting oauth authorization code. ErrorCode %s. Message: %s', error, errorDescription));
    });

    const autorizationCodeResponseParameters = querystring.parse(codeResponse.substring(codeResponse.indexOf('?') + 1));
    const code = autorizationCodeResponseParameters['code'];
    const state = autorizationCodeResponseParameters['state'].replace(new RegExp( '\\sHTTP/.*'), '');

    Logger.getInstance().debug(
      `Received new OAuth authorization code from: ${authorizationUrl.href}`);

    return { code: code, state: state };
  }

  async function convertToResponseType(httpClient, url, options) {
    function asResponseType(response) {
      return new Response(response.json, {
        staus: response.statusCode,
        statusText: response.statusText,
        headers: response.headers
      });
    }

    options.url = url;
    return asResponseType(await httpClient.requestAsync(options));
  }

  async function requestToken(as, tokenUrl, client, clientAuth, params, redirectUri, codeVerifier) {
    try {
      as['token_endpoint'] = tokenUrl.href;
      const response = await oauth.authorizationCodeGrantRequest(
        as,
        client,
        clientAuth,
        params,
        redirectUri,
        codeVerifier,
        {
          [oauth.allowInsecureRequests]: connectionConfig.getOauthHttpAllowed(),
          [oauth.customFetch]: async (url, options) => await convertToResponseType(httpClient, url, options)
        }
      );

      const result = await oauth.processAuthorizationCodeResponse(as, client, response);
      if (result.access_token) {
        Logger.getInstance().debug(
          `Received new OAuth access token from: ${tokenUrl.href}`);
      } else {
        throw Error(`Response doesn't contain OAuth access token. Requested URI: ${tokenUrl.href}`);
      }
      return result.access_token;
    } catch (error) {
      throw new Error(format('Error while getting access token. Message: %s', error.message));
    }
  }

  function getAuthorizationUrl(options) {
    const authCodeUrl = exists(options.getOauthAuthorizationUrl())
      ? options.getOauthAuthorizationUrl()
      : options.accessUrl + SNOWFLAKE_AUTHORIZE_ENDPOINT;
    Logger.getInstance().debug(
      `Url used for receiving authorization code: ${authCodeUrl}`);
    return new URL(authCodeUrl);
  }
  function getTokenUrl(options) {
    const tokenUrl = exists(options.getOauthTokenRequestUrl())
      ? options.getOauthTokenRequestUrl()
      : options.accessUrl + SNOWFLAKE_TOKEN_REQUEST_ENDPOINT;
    Logger.getInstance().debug(
      `Url used for receiving token: ${tokenUrl}`);
    return new URL(tokenUrl);
  }

  async function buildRedirectUri(options, redirectPort) {
    const redirectUri = exists(options.getRedirectUri())
      ? options.getRedirectUri()
      : await createDefaultRedirectUri(redirectPort);
    Logger.getInstance().debug(
      `Authorization code redirect URL: ${redirectUri}`);
    return redirectUri;
  }

  async function createDefaultRedirectUri(redirectPort) {
    return `${DEFAULT_REDIRECT_HOST}:${redirectPort}${DEFAULT_REDIRECT_URI_ENDPOINT}`;
  }

  async function browserAuthorizationCodeProvider(authorizationUrl) {
    return open(authorizationUrl.href);
  }
}

module.exports = AuthOauthAuthorizationCode;

