/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

var util = require('../util');
var rest = require('../global_config').rest;

/**
 * Creates an okta authenticator.
 *
 * @param {String} password
 * @param {String} region
 * @param {String} account
 * @param {String} clientType
 * @param {String} clientVersion
 * @param {module} httpclient
 *
 * @returns {Object}
 * @constructor
 */
function auth_okta(password, region, account, clientType, clientVersion, httpclient)
{
  var axios = typeof httpclient !== "undefined" ? httpclient : require('axios');
  var password = password;

  var host = util.construct_hostname(region, account);
  var port = rest.HTTPS_PORT;
  var protocol = rest.HTTPS_PROTOCOL;

  var clientAppId = clientType;
  var clientAppVersion = clientVersion;
  var samlResponse;

  /**
   * Update JSON body with saml response.
   *
   * @param {JSON} body
   *
   * @returns {null}
   */
  this.updateBody = function (body)
  {
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
  this.authenticate = async function (authenticator, serviceName, account, username)
  {
    var ssoUrl;
    var tokenUrl;
    await step1(authenticator, serviceName, account, username).then((response) =>
    {
      var data = response['data']['data'];
      ssoUrl = data['ssoUrl'];
      tokenUrl = data['tokenUrl'];
    });

    step2(authenticator, ssoUrl, tokenUrl);

    var oneTimeToken;
    await step3(tokenUrl, username, password).then((response) =>
    {
        var data = response['data'];

        if (data['sessionToken']) {
            oneTimeToken = data['sessionToken'];
        }
        else {
            oneTimeToken = data['cookieToken'];
        }
    });

    var responseHtml;
    await step4(oneTimeToken, ssoUrl).then((response) =>
    {
      responseHtml = response['data'];
    });

    step5(responseHtml);
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
  function step1(authenticator, serviceName, account, username)
  {
    // Create URL to send POST request to
    var url = protocol + "://" + host + "/session/authenticator-request";

    var header;
    if (serviceName)
    {
      header = {
        'HTTP_HEADER_SERVICE_NAME': serviceName
      }
    }

    // JSON body to send with POST request
    var body = {
      "data": {
        "ACCOUNT_NAME": account,
        "LOGIN_NAME": username,
        "PORT": port,
        "PROTOCOL": protocol,
        "AUTHENTICATOR": authenticator,
        "CLIENT_APP_ID": clientAppId,
        "CLIENT_APP_VERSION": clientAppVersion
      }
    };

    // POST request to get SSO URL and token URL
    return axios
      .post(url, body, {
        headers: header
      })
      .catch(requestErr =>
      {
        throw requestErr;
      });
  };

  /**
  * Check the URLs prefix are equal to the authenticator.
  *
  * @param {String} authenticator
  * @param {String} ssoUrl
  * @param {String} tokenUrl
  *
  * @returns {null}
  */
  function step2(authenticator, ssoUrl, tokenUrl)
  {
    authenticator = authenticator.toLowerCase();
    if (!(authenticator.startsWith(ssoUrl.substring(0, authenticator.length)) &&
      authenticator.startsWith(tokenUrl.substring(0, authenticator.length))))
    {
      throw new Error("The prefix of the SSO/token URL and the specified authenticator do not match.");
    }
  };

  /**
  * Retrieve the access token through the token url.
  *
  * @param {String} tokenUrl
  * @param {String} username
  * @param {String} password
  *
  * @returns {Object}
  */
  function step3(tokenUrl, username, password)
  {
    // JSON body to send with POST request
    var body = {
      "username": username,
      "password": password
    };

    // Query IDP token url to authenticate and retrieve access token
    return axios
      .post(tokenUrl, body)
      .catch(requestErr =>
      {
        throw requestErr;
      });
  };

  /**
  * Retrieve the SAML response through the SSO URL.
  *
  * @param {String} oneTimeToken
  * @param {String} ssoUrl
  *
  * @returns {Object}
  */
  function step4(oneTimeToken, ssoUrl)
  {
    // Query IDP URL to get SAML response
    return axios
      .get(ssoUrl, {
        params: {
          'RelayState': "/some/deep/link",
          'onetimetoken': oneTimeToken,
        }}
      )
      .catch(requestErr =>
      {
        throw requestErr;
      });
  };

  /**
  * Validate the postback URL inside the SAML response.
  *
  * @param {String} responseHtml
  *
  * @returns {null}
  */
  function step5(responseHtml)
  {
    var postBackUrl = getPostBackUrlFromHtml(responseHtml);
    var fullUrl = util.format("%s://%s:%s", protocol, host, port);    

    // Validate the post back url come back with the SAML response
    // contains the same prefix as the Snowflake's server url, which is the
    // intended destination url to Snowflake.
    if (postBackUrl.substring(0, 20) !== fullUrl.substring(0, 20))
    {
      throw new Error(util.format("The specified authenticator and destination URL " +
        "in the SAML assertion do not match: expected: %s postback: %s", fullUrl, postBackUrl));      
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
  function getPostBackUrlFromHtml(html)
  {
    var index = html.search("<form");
    var startIndex = html.indexOf("action=\"", index);
    var endIndex = html.indexOf("\"", startIndex + 8);

    return unescapeHtml(html.substring(startIndex + 8, endIndex));
  }

  /**
  * Unescape the HTML hex characters in the string.
  *
  * @param {String} html
  *
  * @returns {String}
  */
  function unescapeHtml(html)
  {
    return html
      .replace(/&#x3a;/g, ":")
      .replace(/&#x2f;/g, "/");
  }
}

module.exports = auth_okta;
