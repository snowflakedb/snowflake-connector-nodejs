const Logger = require('./../logger');
const authUtil = require('../authentication/authentication_util');
const { exists, format } = require('../util');
const AuthenticationTypes = require('./authentication_types');
/**
 * Creates an oauth authenticator.
 *
 *
 * @returns {Object}
 * @constructor
 * @param connectionConfig
 * @param httpClient
 */
function AuthOauthClientCredentials(connectionConfig, httpClient) {

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
    body['data']['AUTHENTICATOR'] = AuthenticationTypes.OAUTH_AUTHENTICATOR;
    body['data']['OAUTH_TYPE'] = AuthenticationTypes.OAUTH_CLIENT_CREDENTIALS;
  };

  this.loadOauth4webapi =  async function () {
    if (!oauth) {
      oauth = await import('oauth4webapi');
    }
  };

  this.authenticate = async function () {
    globalThis.crypto ??= require('node:crypto').webcrypto;
    await this.loadOauth4webapi(); // import module using the dynamic import
    //An issuer is a obligatory parameter in validation processed by oauth4webapi library, even when it isn't used
    const as = { issuer: 'UNKNOWN' };
    const clientId = connectionConfig.getOauthClientId();  // Client ID
    const clientSecret = connectionConfig.getOauthClientSecret();  // Client Secret
    const client = { client_id: clientId };
    const clientAuth = oauth.ClientSecretPost(clientSecret);
    const scope = await authUtil.prepareScope(connectionConfig);
    const parameters = new URLSearchParams();
    parameters.set('scope', scope);

    const tokenUrl = authUtil.getTokenUrl(connectionConfig);
    token = await requestToken(as, tokenUrl, oauth, client, clientAuth, parameters);
  };


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

  async function requestToken(as, tokenUrl, oauth, client, clientAuth, parameters) {
    try {
      as['token_endpoint'] = tokenUrl.href;
      const response = await oauth.clientCredentialsGrantRequest(as, client, clientAuth, parameters, {
        [oauth.allowInsecureRequests]: connectionConfig.getOauthHttpAllowed(),
        [oauth.customFetch]: async (url, options) => await convertToResponseType(httpClient, url, options)
      });

      const result = await oauth.processClientCredentialsResponse(as, client, response);

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

}

module.exports = AuthOauthClientCredentials;

