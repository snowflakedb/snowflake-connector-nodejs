/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const net = require('net');

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
      // User successfully entered credentials
      socket.write(successResponse);

      // Receive the data and split by line
      const data = chunk.toString().split('\r\n');

      socket.destroy();
      server.close();

      if (data[0].includes('?error=')) {
        reject(data[0]);
      } else {
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

exports.createServer = createServer;
exports.withBrowserActionTimeout = withBrowserActionTimeout;
