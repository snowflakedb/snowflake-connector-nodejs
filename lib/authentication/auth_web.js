/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

var util = require('../util');
var net = require('net');
var querystring = require('querystring');

var HTTPS_PORT = 443;
var HTTPS_PROTOCOL = 'https';

/**
 * Creates an external browser authenticator.
 *
 * @param {String} region
 * @param {String} account
 * @param {module} webbrowser
 * @param {module} httpclient
 *
 * @returns {Object}
 * @constructor
 */
function auth_web(region, account, webbrowser, httpclient)
{
  var open = typeof webbrowser !== "undefined" ? webbrowser : require('open');
  var axios = typeof httpclient !== "undefined" ? httpclient : require('axios');

  var host = util.construct_hostname(region, account);
  var port = HTTPS_PORT;
  var protocol = HTTPS_PROTOCOL;
  var proof_key;
  var token;
  var data;

  var successResponse = Buffer.from('Your identity was confirmed and propagated to Snowflake Node.js driver. You can close this window now and go back where you started from.', 'utf8');

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
    body['data']['PROOF_KEY'] = proof_key;
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
  this.authenticate = async function (authenticator, serviceName, account, username)
  {
    var server;

    var receiveData = new Promise(async (resolve) =>
    {
      // Server to receive SAML token
      server = createServer(resolve);
    }).then((result) =>
    {
      return result;
    });

    // Use a free random port and set to no backlog
    server.listen(0, 0);

    // Step 1: query Snowflake to obtain SSO url
    var ssoURL = await getSSOURL(authenticator,
      serviceName,
      account,
      server.address().port,
      username);

    // Step 2: open browser
    open(ssoURL);

    // Step 3: get SAML token
    data = await receiveData;
    processGet(data);
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
   * Get SSO URL through POST request.
   * 
   * @param {String} authenticator
   * @param {String} service_name
   * @param {String} account
   * @param {Number} callback_port
   * @param {String} user
   * 
   * @returns {String} the SSO URL.
   */
  function getSSOURL(authenticator, service_name, account, callback_port, user)
  {
    // Create URL to send POST request to
    var url = protocol + '://' + host + "/session/authenticator-request";

    var header;
    if (service_name)
    {
      header = {
        'HTTP_HEADER_SERVICE_NAME': service_name
      }
    }

    // JSON body to send with POST request
    var body = {
      "data": {
        "ACCOUNT_NAME": account,
        "LOGIN_NAME": user,
        "PORT": port,
        "PROTOCOL": protocol,
        "AUTHENTICATOR": authenticator,
        "BROWSER_MODE_REDIRECT_PORT": callback_port.toString()
      }
    };

    // Post request to get the SSO URL
    return axios
      .post(url, body, {
        headers: header
      })
      .then((response) =>
      {
        var data = response['data']['data'];
        proof_key = data['proofKey'];

        return data['ssoUrl'];
      })
      .catch(requestErr =>
      {
        throw requestErr;
      });
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
}

module.exports = auth_web;
