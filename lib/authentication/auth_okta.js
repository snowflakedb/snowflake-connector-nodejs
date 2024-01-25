/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

const util = require('../util');
const rest = require('../global_config').rest;
const Logger = require('../logger');

/**
 * Creates an okta authenticator.
 *
 * @param {Object} connectionConfig
 * @param {HttpClient} httpClient
 *
 * @returns {Object}
 * @constructor
 */
function AuthOkta(connectionConfig, httpClient) {
  const password = connectionConfig.password;
  const region = connectionConfig.region;
  const account = connectionConfig.account;
  const clientAppId = connectionConfig.getClientType();
  const clientAppVersion = connectionConfig.getClientVersion();
  const host = util.constructHostname(region, account);
  const port = rest.HTTPS_PORT;
  const protocol = rest.HTTPS_PROTOCOL;
  let user;
  let ssoUrl;
  let tokenUrl;
  let samlResponse;

  /**
   * Update JSON body with saml response.
   *
   * @param {JSON} body
   *
   * @returns {null}
   */
  this.updateBody = function (body) {
    body['data']['RAW_SAML_RESPONSE'] = samlResponse;
  };

  /**
  * Obtain saml response from Okta.
  *
  * @param {String} authenticator
  * @param {String} serviceName
  * @param {String} account
  * @param {String} username
  *
  * @returns {null}
  */
  this.authenticate = async function (authenticator, serviceName, account, username) {
    const response = await step1(authenticator, serviceName, account, username);
    const responseData = response['data'];
    const success = responseData['success'];
    const errorCode = responseData['code'];
    const errorMessage = responseData['message'];
    user = username;

    if (typeof success === 'undefined' || errorCode === 'undefined' || errorMessage === 'undefined') {
      throw new Error('Unable to use provided Okta address as an authenticator. Is the authenticator URL correct?');
    }

    if (success !== true) {
      throw new Error(`Unable to use provided Okta address as an authenticator. Error code: ${errorCode}, error message: ${errorMessage}`);
    }

    ssoUrl = responseData['data']['ssoUrl'];
    tokenUrl = responseData['data']['tokenUrl'];

    step2(authenticator, ssoUrl, tokenUrl);
    
    const responseHtml = await step4( await step3(tokenUrl, username, password), ssoUrl);

    step5(responseHtml);
  };

  this.reauthenticate = async function (body, retryOption) {
    const responseHtml = await step4( await step3(tokenUrl, user, password), ssoUrl, retryOption);
    step5(responseHtml);

    this.updateBody(body);
  }; 

  /**
  * Obtain the SSO URL and token URL.
  *
  * @param {String} authenticator
  * @param {String} serviceName
  * @param {String} account
  * @param {String} username
  *
  * @returns {Object}
  */
  async function step1(authenticator, serviceName, account, username) {
    // Create URL to send POST request to
    const url = protocol + '://' + host + '/session/authenticator-request';

    let header;
    if (serviceName) {
      header = {
        'HTTP_HEADER_SERVICE_NAME': serviceName
      };
    }

    // JSON body to send with POST request
    const body = {
      'data': {
        'ACCOUNT_NAME': account,
        'LOGIN_NAME': username,
        'PORT': port,
        'PROTOCOL': protocol,
        'AUTHENTICATOR': authenticator,
        'CLIENT_APP_ID': clientAppId,
        'CLIENT_APP_VERSION': clientAppVersion
      }
    };

    // POST request to get SSO URL and token URL
    return await httpClient.post(url, body, {
      headers: header
    });
  }

  /**
  * Check the URLs prefix are equal to the authenticator.
  *
  * @param {String} authenticator
  * @param {String} ssoUrl
  * @param {String} tokenUrl
  *
  * @returns {null}
  */
  function step2(authenticator, ssoUrl, tokenUrl) {
    authenticator = authenticator.toLowerCase();
    if (!(authenticator.startsWith(ssoUrl.substring(0, authenticator.length)) &&
      authenticator.startsWith(tokenUrl.substring(0, authenticator.length)))) {
      throw new Error('The prefix of the SSO/token URL and the specified authenticator do not match.');
    }
  }

  /**
  * Retrieve the access token through the token url.
  *
  * @param {String} tokenUrl
  * @param {String} username
  * @param {String} password
  *
  * @returns {Object}
  */
  async function step3(tokenUrl, username, password) {
    // JSON body to send with POST request
    const body = {
      'username': username,
      'password': password
    };

    // Query IDP token url to authenticate and retrieve access token
    const response = await httpClient.post(tokenUrl, body);
    const data = response['data'];
    let oneTimeToken;
  
    if (data['sessionToken']) {
      oneTimeToken = data['sessionToken'];
    } else {
      oneTimeToken = data['cookieToken'];
    }
    return oneTimeToken;
  }

  /**
  * Retrieve the SAML response through the SSO URL.
  *
  * @param {String} oneTimeToken
  * @param {String} ssoUrl
  *
  * @returns {Object}
  */
  async function step4(oneTimeToken, ssoUrl, retryOption = { remainingTimeout: null, numofRetries: 0 }) {
    // Query IDP URL to get SAML response
    const remainingTimeout = retryOption.remainingTimeout || connectionConfig.getTimeout();
    let response;

    const startTime = Date.now();
    while (remainingTimeout === 0 || Date.now() < startTime + remainingTimeout) {
      try { 
        response = await httpClient.get(ssoUrl, {
          params: {
            'RelayState': '/some/deep/link',
            'onetimetoken': oneTimeToken,
          } }
        );
        break;
      } catch (err) {   
        Logger.getInstance().debug('step4: refresh token for re-authentication');
        retryOption.numofRetries++;
      }
    }

    if (remainingTimeout !== 0 && startTime + remainingTimeout < Date.now()) {
      Logger.getInstance().warn(`step4: Fail to get SAML response, timeout reached: ${remainingTimeout} miliseconds`);
      throw new Error('Reached out to the Login Timeout');
    }

    retryOption.remainingTimeout = remainingTimeout - startTime;
    return response['data'];
  }

  /**
  * Validate the postback URL inside the SAML response.
  *
  * @param {String} responseHtml
  *
  * @returns {null}
  */
  function step5(responseHtml) {
    const postBackUrl = getPostBackUrlFromHtml(responseHtml);
    const fullUrl = util.format('%s://%s:%s', protocol, host, port);    

    // Validate the post back url come back with the SAML response
    // contains the same prefix as the Snowflake's server url, which is the
    // intended destination url to Snowflake.
    if (postBackUrl.substring(0, 20) !== fullUrl.substring(0, 20)) {
      throw new Error(util.format('The specified authenticator and destination URL ' +
        'in the SAML assertion do not match: expected: %s postback: %s', fullUrl, postBackUrl));      
    }
    samlResponse = responseHtml;
  }

  /**
  * Extract the postback URL from the HTML response.
  *
  * @param {String} html
  *
  * @returns {String}
  */
  function getPostBackUrlFromHtml(html) {
    const index = html.search('<form');
    const startIndex = html.indexOf('action="', index);
    const endIndex = html.indexOf('"', startIndex + 8);

    return unescapeHtml(html.substring(startIndex + 8, endIndex));
  }

  /**
  * Unescape the HTML hex characters in the string.
  *
  * @param {String} html
  *
  * @returns {String}
  */
  function unescapeHtml(html) {
    return html
      .replace(/&#x3a;/g, ':')
      .replace(/&#x2f;/g, '/');
  }
}

module.exports = AuthOkta;
