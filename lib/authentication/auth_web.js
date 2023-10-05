/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

const util = require('../util');
const net = require('net');
const querystring = require('querystring');
const URLUtil = require('./../../lib/url_util');
const Util = require('./../../lib/util');
const SsoUrlProvider = require('../authentication/sso_url_provider');

/**
 * Creates an external browser authenticator.
 *
 * @param {Object} connectionConfig
 * @param {Object} ssoUrlProvider
 * @param {module} webbrowser
 *
 * @returns {Object}
 * @constructor
 */
function auth_web(connectionConfig, httpClient, webbrowser) {

  const host = connectionConfig.host;
  const browserActionTimeout = connectionConfig.getBrowserActionTimeout();
  const ssoUrlProvider = new SsoUrlProvider(httpClient);

  if (!Util.exists(host)) {
    throw new Error(`Invalid value for host: ${host}`);
  }
  if (!Util.number.isPositiveInteger(browserActionTimeout)) {
    throw new Error(`Invalid value for browser action timeout: ${browserActionTimeout}`);
  }

  const open = typeof webbrowser !== "undefined" ? webbrowser : require('open');

  let proofKey;
  let token;

  const successResponse = 'HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nYour identity was confirmed and propagated to Snowflake Node.js driver. You can close this window now and go back where you started from.';

  /**
   * Update JSON body with token and proof_key.
   *
   * @param {JSON} body
   *
   * @returns {null}
   */
  this.updateBody = function (body)
  {
    body['data']['TOKEN'] = token;
    body['data']['PROOF_KEY'] = proofKey;
  };

  /**
   * Obtain SAML token through SSO URL.
   *
   * @param {String} authenticator
   * @param {String} serviceName
   * @param {String} account
   * @param {String} username
   *
   * @returns {null}
   */
  this.authenticate = async function (authenticator, serviceName, account, username) {
    let server;

    const receiveData = new Promise(async (resolve) => {
      // Server to receive SAML token
      server = createServer(resolve);
    }).then((result) => {
      return result;
    });

    // Use a free random port and set to no backlog
    server.listen(0, 0);

    // Step 1: query Snowflake to obtain SSO url
    const ssoData = await ssoUrlProvider.getSSOURL(authenticator,
      serviceName,
      account,
      server.address().port,
      username,
      host);

    proofKey = ssoData['proofKey'];

    // Step 2: validate URL
    let ssoURL = ssoData['ssoUrl'];
    if (!URLUtil.isValidURL(ssoURL)) {
      throw new Error(util.format("Invalid SSO URL found - %s ", ssoURL));
    }

    // Step 3: open browser
    open(ssoURL);

    // Step 4: get SAML token
    const tokenData = await withBrowserActionTimeout(browserActionTimeout, receiveData)
    processGet(tokenData);
  };

  /**
   * Create server to retrieve SAML token.
   *
   * @param {Function} resolve
   *
   * @returns {Server}
   */
  function createServer(resolve)
  {
    var server = net.createServer(function (socket)
    {
      socket.on('data', function (chunk)
      {
        // User successfully entered credentials
        socket.write(successResponse);

        // Receive the data and split by line
        var data = chunk.toString().split("\r\n");

        // Stop accepting connections and close
        socket.destroy();
        server.close();

        resolve(data);
      });
      socket.on('error', (socketErr) =>
      {
        if (socketErr['code'] === 'ECONNRESET')
        {
          socket.end();
        }
        else
        {
          throw socketErr;
        }
      });
    });

    return server;
  };

  /**
   * Parse the GET request and get token parameter value.
   *
   * @param {String[]} data
   *    
   * @returns {null}
   */
  function processGet(data)
  {
    var targetLine;

    for (const line of data)
    {
      if (line.startsWith("GET "))
      {
        targetLine = line;
        break;
      }
      else
      {
        return;
      }
    }


    // Split the GET request line
    targetLine = targetLine.split(" ");

    // Get value of the "token" query parameter
    token = querystring.parse(targetLine[1])["/?token"];
  };

  const withBrowserActionTimeout = (millis, promise) => {
    const timeout = new Promise((resolve, reject) =>
      setTimeout(
        () => reject(`Browser action timed out after ${browserActionTimeout} ms.`),
        millis));
    return Promise.race([
      promise,
      timeout
    ]);
  };
}

module.exports = auth_web;
