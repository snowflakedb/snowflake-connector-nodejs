const Logger = require('./../logger');
const authUtil = require('../authentication/authentication_util');
const { getFreePort, exists, format } = require('../util');
const { withBrowserActionTimeout } = require('./authentication_util');
const querystring = require('querystring');
const GlobalConfig = require('../global_config');
const open = require('open');
const Util = require('../util');
const AuthenticationTypes = require('./authentication_types');

/**
 * Creates an oauth authenticator.
 *
 * @param {Object} connectionConfig
 * @param {Object} httpClient
 *
 * @returns {Object}
 * @constructor
 */
function AuthOauthAuthorizationCode(connectionConfig, httpClient) {
  const SNOWFLAKE_AUTHORIZE_ENDPOINT = '/oauth/authorize';
  const DEFAULT_REDIRECT_HOST = 'http://127.0.0.1';
  const DEFAULT_REDIRECT_URI_ENDPOINT = '/';
  const browserActionTimeout = connectionConfig.getBrowserActionTimeout();

  let oauth;
  let token;

  const accessTokenKey = Util.buildCredentialCacheKey(connectionConfig.host,
    connectionConfig.username, AuthenticationTypes.OAUTH_AUTHORIZATION_CODE + 'access_token');
  const refreshTokenKey = Util.buildCredentialCacheKey(connectionConfig.host,
    connectionConfig.username, AuthenticationTypes.OAUTH_AUTHORIZATION_CODE + 'refresh_token');

  /**
   * Update JSON body with token.
   * @param {JSON} body
   * @returns {null}
   */
  this.updateBody = function (body) {
    if (exists(token)) {
      body['data']['TOKEN'] = token;
    }
    body['data']['AUTHENTICATOR'] = AuthenticationTypes.OAUTH_AUTHENTICATOR;
    body['data']['OAUTH_TYPE'] = AuthenticationTypes.OAUTH_AUTHORIZATION_CODE;
  };

  this.loadOauth4webapi = async function () {
    if (!oauth) {
      oauth = await import('oauth4webapi');
    }
  };

  this.authenticate = async function () {
    globalThis.crypto ??= require('node:crypto').webcrypto;

    //verify that there is access token in the cache
    const accessTokenFromCache = await GlobalConfig.getCredentialManager().read(accessTokenKey);
    //verify that there is refresh token in the cache
    const refreshTokenFromCache = await GlobalConfig.getCredentialManager().read(refreshTokenKey);
    if (accessTokenFromCache) {
      token = accessTokenFromCache;
    } else if (refreshTokenFromCache) {
      token = await this.getAccessTokenUsingRefreshToken(refreshTokenFromCache);
    } else {
      await this.loadOauth4webapi(); // import module using the dynamic import
      const codeChallengeMethod = connectionConfig.challangeMethod || 'S256'; // TODO: should be verified with "discovery" response
      const issuer = connectionConfig.issuer || 'UNKNOWN';
      const codeVerifier = oauth.generateRandomCodeVerifier();
      const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);
      const as = { issuer: issuer };
      const clientId = connectionConfig.getOauthClientId();
      const clientSecret = connectionConfig.getOauthClientSecret();
      // eslint-disable-next-line camelcase
      const client = { client_id: clientId };
      const clientAuth = oauth.ClientSecretPost(clientSecret);

      const redirectUri = await buildRedirectUri(connectionConfig);
      const scope = await prepareScope(connectionConfig) + ' offline_access';

      const authorizationUrl = await prepareAuthorizationUrl(client, redirectUri, codeChallenge, codeChallengeMethod, as, scope);

      const authorizationCodeResponse = await requestAuthorizationCode(authorizationUrl, browserActionTimeout);
      const params = oauth.validateAuthResponse(as, client, authorizationUrl, authorizationCodeResponse.state);

      const tokenUrl = authUtil.getTokenUrl(connectionConfig);
      params.set('code', authorizationCodeResponse.code);
      Logger.getInstance().trace('Requesting token');
      token = await requestToken(as, tokenUrl, client, clientAuth, params, redirectUri, codeVerifier);
    }
  };

  this.reauthenticate = async function (body) {

    await GlobalConfig.getCredentialManager().remove(accessTokenKey);

    const refreshToken = await GlobalConfig.getCredentialManager().read(refreshTokenKey);

    if (refreshToken) {
      try {
        await this.getAccessTokenUsingRefreshToken(refreshToken);
        this.updateBody(body);
      } catch (error) {
        await GlobalConfig.getCredentialManager().remove(refreshTokenKey);
        Logger.getInstance().error(format('Error while getting access token using refresh token. Message: %s. The refresh token is removed form cache - authentication must be proceed from the beginning', error.message));
        await this.authenticate();
        this.updateBody(body);
      }
    } else {
      await this.authenticate();
      this.updateBody(body);
    }
  };

  this.getAccessTokenUsingRefreshToken = async function (refreshToken){
    // try {
      globalThis.crypto ??= require('node:crypto').webcrypto;

      await this.loadOauth4webapi(); // import module using the dynamic import
      const issuer = connectionConfig.issuer || 'UNKNOWN';
      const as = { issuer: issuer };
      const clientId = connectionConfig.getOauthClientId();
      const clientSecret = connectionConfig.getOauthClientSecret();
      // eslint-disable-next-line camelcase
      const client = { client_id: clientId };
      const clientAuth = oauth.ClientSecretPost(clientSecret);

      // Refresh Token Grant Request & Response
      const tokenUrl = authUtil.getTokenUrl(connectionConfig);
      Logger.getInstance().trace(
        `Receiving new OAuth access token from: Host: ${tokenUrl.host} Path: ${tokenUrl.pathname}`);
      as['token_endpoint'] = tokenUrl.href;
      const response = await oauth.refreshTokenGrantRequest(as, client, clientAuth, refreshToken, {
        [oauth.allowInsecureRequests]: connectionConfig.getOauthHttpAllowed(),
        [oauth.customFetch]: async (url, options) => await convertToResponseType(httpClient, url, options)
      });

      const result = await oauth.processRefreshTokenResponse(as, client, response);

      if (result.access_token) {
        await GlobalConfig.getCredentialManager().remove(accessTokenKey);
        await GlobalConfig.getCredentialManager().write(accessTokenKey, result.access_token);
      } else {
        throw new Error('Error during refreshing access token');
      }

      if (result.refresh_token) {
        await GlobalConfig.getCredentialManager().remove(refreshTokenKey);
        await GlobalConfig.getCredentialManager().write(refreshTokenKey, result.refresh_token);
      } else {
        Logger.getInstance().warn('There is no refresh_token value to write to cache. Clearing refresh token in cache');
        await GlobalConfig.getCredentialManager().remove(refreshTokenKey);
      }
      return result.access_token;
    // } catch (error) {
    //   Logger.getInstance().error(format('Error while getting access token. Message: %s', error.message));
    // }
  };

  async function prepareAuthorizationUrl(client, redirectUri, codeChallenge, codeChallengeMethod, as, scope) {
    const authorizationUrl = getAuthorizationUrl(connectionConfig);
    authorizationUrl.searchParams.set('client_id', client.client_id);
    authorizationUrl.searchParams.set('redirect_uri', redirectUri);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('scope', scope);
    authorizationUrl.searchParams.set('code_challenge', codeChallenge);
    authorizationUrl.searchParams.set('code_challenge_method', codeChallengeMethod);

    /**
     * We cannot be sure PKCE is supported then the state should be used.
     */
    if (as.code_challenge_methods_supported?.includes('S256') !== true) {
      const state = oauth.generateRandomState();
      authorizationUrl.searchParams.set('state', state);
    }
    return authorizationUrl;
  }

  async function requestAuthorizationCode(authorizationUrl, browserActionTimeout) {
    if (!Util.number.isPositiveInteger(browserActionTimeout)) {
      throw new Error(`Invalid value for browser action timeout: ${browserActionTimeout}`);
    }
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

    const codeResponse = await withBrowserActionTimeout(browserActionTimeout, receiveData)
      .catch((rejected) => {
        server.close();
        throw new Error(rejected);
      });

    const autorizationCodeResponseParameters = querystring.parse(codeResponse.substring(codeResponse.indexOf('?') + 1));
    const code = autorizationCodeResponseParameters['code'];
    const state = autorizationCodeResponseParameters['state'].replace(new RegExp('\\sHTTP/.*'), '');

    Logger.getInstance().debug(
      `Received new OAuth authorization code from: Host: ${authorizationUrl.host} Path: ${authorizationUrl.pathname}`);

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
      Logger.getInstance().trace(
        `Receiving new OAuth access token from: Host: ${tokenUrl.host} Path: ${tokenUrl.pathname}`);
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
        //cache access token
        Logger.getInstance().debug(
          `Received new OAuth access token from: Host: ${tokenUrl.host} Path: ${tokenUrl.pathname}`);
        await GlobalConfig.getCredentialManager().write(accessTokenKey, result.access_token);
        //cache refreshToken if exists
        if (result.refresh_token) {
          //cache refresh token
          Logger.getInstance().debug(
            `Received new OAuth refresh token from: Host: ${tokenUrl.host} Path: ${tokenUrl.pathname}`);
          await GlobalConfig.getCredentialManager().remove(refreshTokenKey);
          await GlobalConfig.getCredentialManager().write(refreshTokenKey, result.refresh_token);
        }
      } else {
        throw Error(`Response doesn't contain OAuth access token. Requested URI: Host: ${tokenUrl.host} Path: ${tokenUrl.pathname}`);
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

  async function buildRedirectUri(options) {
    const redirectUri = exists(options.getRedirectUri())
      ? options.getRedirectUri()
      : await createDefaultRedirectUri();
    Logger.getInstance().debug(
      `Authorization code redirect URL: ${redirectUri}`);
    return redirectUri;
  }

  async function prepareScope(options) {
    const scope = exists(options.getOauthScope())
      ? options.getOauthScope()
      : `session:role:${options.getRole()}`;
    Logger.getInstance().debug(
      `Prepared scope used for receiving authorization code: ${scope}`);
    return scope;
  }

  async function createDefaultRedirectUri() {
    const redirectPort = await getFreePort();
    return `${DEFAULT_REDIRECT_HOST}:${redirectPort}${DEFAULT_REDIRECT_URI_ENDPOINT}`;
  }

  async function browserAuthorizationCodeProvider(authorizationUrl) {
    return open(authorizationUrl.href);
  }
}

module.exports = AuthOauthAuthorizationCode;

