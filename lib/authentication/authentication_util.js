const net = require('net');
const querystring = require('querystring');

const { exists,  format, escapeHTML  } = require('../util');
const Logger = require('../logger');

const SNOWFLAKE_TOKEN_REQUEST_ENDPOINT = '/oauth/token-request';
const responseHeadersAsString = 'HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nConnection: close\r\n\r\n';
const successResponse = 'Your identity was confirmed and propagated to Snowflake Node.js driver. You can close this window now and go back where you started from.';

/**
 * Create server to retrieve SAML token.
 *
 * @param {Function} resolve
 * @param {Function} reject
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
        socket.write(`${responseHeadersAsString} ${error}`, 'utf8');
        socket.destroy();
        server.close();
        Logger.getInstance().trace(`Error during authorization: ${error}`);
        reject(error);
      } else {
        // User successfully entered credentials
        socket.write(`${responseHeadersAsString} ${escapeHTML(successResponse)}`, 'utf8');
        socket.destroy();
        server.close();
        Logger.getInstance().trace('User successfully entered authorization code');
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
  return escapeHTML(format('Error while getting oauth authorization code. ErrorCode %s. Message: %s', error, errorDescription));
}


function getTokenUrl(options) {
  const tokenUrl = exists(options.getOauthTokenRequestUrl())
    ? options.getOauthTokenRequestUrl()
    : options.accessUrl + SNOWFLAKE_TOKEN_REQUEST_ENDPOINT;
  Logger.getInstance().debug(
    `Url used for receiving token: ${tokenUrl}`);
  return new URL(tokenUrl);
}

exports.createServer = createServer;
exports.withBrowserActionTimeout = withBrowserActionTimeout;
exports.getTokenUrl = getTokenUrl;
