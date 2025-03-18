/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const net = require('net');
const querystring = require('querystring');
const {format} = require('../util');

const successResponse = 'HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\nYour identity was confirmed and propagated to Snowflake Node.js driver. You can close this window now and go back where you started from.';

/**
 * Create server to retrieve SAML token.
 *
 * @param {Function} resolve
 *
 * @returns {Server}
 */
function createServer(resolve, reject) {
  const server = net.createServer(function (socket) {
    socket.on('data', function (chunk) {

      // Receive the data and split by line
      const data = chunk.toString().split('\r\n');

      if (data[0].includes('?error=')) {
        // Error d credentials
        const error = prepareError(data[0]);
        socket.write(error);
        socket.destroy();
        server.close();
        reject(error);
      } else {
        // User successfully entered credentials
        socket.write(successResponse);
        socket.destroy();
        server.close();
        resolve(data[0]);
      }

    });
    socket.on('error', (socketErr) => {
      if (socketErr['code'] === 'ECONNRESET') {
        socket.end();
      } else {
        throw socketErr;
      }
    });
  });

  return server;
}

const withBrowserActionTimeout = (millis, promise) => {
  const timeout = new Promise((resolve, reject) =>
    setTimeout(
      () => reject(`Browser action timed out after ${millis} ms.`),
      millis));
  return Promise.race([
    promise,
    timeout
  ]);
};

function prepareError(rejected) {
  const errorResponse = querystring.parse(rejected.substring(rejected.indexOf('?') + 1));
  const error = errorResponse['error'];
  const errorDescription = errorResponse['error_description'].replace(new RegExp('\\sHTTP/.*'), '');
  return format('Error while getting oauth authorization code. ErrorCode %s. Message: %s', error, errorDescription);
}

exports.createServer = createServer;
exports.withBrowserActionTimeout = withBrowserActionTimeout;
