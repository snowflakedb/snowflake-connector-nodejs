const net = require('net');
const querystring = require('querystring');

const { exists, format, escapeHTML } = require('../util');
const Logger = require('../logger');
const GlobalConfig = require('../global_config');

const HTML_RESPONSE_HEADERS =
  'HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n';
const SNOWFLAKE_DOMAIN_REGEX = /(^|\.)snowflakecomputing\.(com|cn)/;

const defaultRenderer = ({ error }) =>
  error ??
  escapeHTML(
    'Your identity was confirmed and propagated to Snowflake Node.js driver. ' +
      'You can close this window now and go back where you started from.',
  );

/**
 * Create server to retrieve SAML token or OAuth authorization code.
 *
 * The server responds to the browser with `Content-Type: text/html; charset=utf-8`.
 * When `options.renderer` is provided, its output is used verbatim as the
 * response body; otherwise the default body is sent (HTML-escaped).
 *
 * @param {Function} resolve
 * @param {Function} [reject]
 * @param {{ renderer?: (result: { error: string | null }) => string }} [options]
 *
 * @returns {Server}
 */
function createServer(resolve, reject, options = {}) {
  const renderer = options.renderer || defaultRenderer;
  const server = net.createServer(function (socket) {
    socket.on('data', function (chunk) {
      try {
        // Receive the data and split by line
        const data = chunk.toString().split('\r\n');
        const error = data[0].includes('?error=') ? prepareError(data[0]) : null;
        const body = renderer({ error: error ? escapeHTML(error) : null });

        socket.write(`${HTML_RESPONSE_HEADERS}${body}`, 'utf8');
        socket.destroy();
        server.close();

        if (error) {
          Logger.getInstance().trace(`Error during authorization: ${error}`);
          reject(error);
        } else {
          Logger.getInstance().trace('User successfully entered authorization code');
          resolve(data[0]);
        }
      } catch (err) {
        // Any synchronous failure while processing the redirect (e.g. a throwing
        // renderer, or a malformed error redirect) must reject the promise
        // rather than escape to the event loop as an uncaughtException.
        socket.destroy();
        server.close();
        reject(err);
      }
    });
    socket.on('error', (socketErr) => {
      if (socketErr['code'] === 'ECONNRESET') {
        // Browsers commonly reset the connection after receiving the response;
        // this is expected and not an authentication failure.
        socket.end();
      } else {
        // Throwing from an EventEmitter listener cannot reach the caller's
        // promise and would crash the process via uncaughtException; reject
        // the surrounding promise instead.
        server.close();
        reject(socketErr);
      }
    });
  });
  return server;
}

const withBrowserActionTimeout = (millis, promise) => {
  let timeoutId;
  const timeout = new Promise(
    (resolve, reject) =>
      (timeoutId = setTimeout(
        () => reject(`Browser action timed out after ${millis} ms.`),
        millis,
      )),
  );
  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timeoutId);
  });
};

function prepareError(rejected) {
  const errorResponse = querystring.parse(rejected.substring(rejected.indexOf('?') + 1));
  const error = errorResponse['error'];
  // IdPs are not required to send error_description; guard against it so we
  // don't crash the data handler when it's missing.
  const rawDescription = errorResponse['error_description'];
  const errorDescription =
    typeof rawDescription === 'string'
      ? rawDescription.replace(/\sHTTP\/.*/, '')
      : '(no description)';
  return format(
    'Error while getting oauth authorization code. ErrorCode %s. Message: %s',
    error,
    errorDescription,
  );
}

function getTokenUrl(options) {
  const tokenUrl = options.getOauthTokenRequestUrl();
  Logger.getInstance().debug(`Url used for receiving token: ${tokenUrl}`);
  return new URL(tokenUrl);
}

function prepareScope(options) {
  const oauthScope = options.getOauthScope();
  const role = options.getRole();

  let scope = null;
  if (oauthScope) {
    scope = oauthScope;
  } else if (role) {
    scope = `session:role:${role}`;
  }

  Logger.getInstance().debug(`Prepared scope used for receiving authorization code: ${scope}`);
  return scope;
}

const readCache = async (key) => {
  if (exists(GlobalConfig.getCredentialManager())) {
    return GlobalConfig.getCredentialManager().read(key);
  } else {
    return null;
  }
};

const writeToCache = async (key, value) => {
  if (exists(GlobalConfig.getCredentialManager())) {
    return GlobalConfig.getCredentialManager().write(key, value);
  }
};

const removeFromCache = async (key) => {
  if (exists(GlobalConfig.getCredentialManager())) {
    return GlobalConfig.getCredentialManager().remove(key);
  }
};

const isSnowflakeHost = (url) => {
  return SNOWFLAKE_DOMAIN_REGEX.test(url);
};

exports.createServer = createServer;
exports.withBrowserActionTimeout = withBrowserActionTimeout;
exports.getTokenUrl = getTokenUrl;
exports.prepareScope = prepareScope;
exports.readCache = readCache;
exports.writeToCache = writeToCache;
exports.removeFromCache = removeFromCache;
exports.isSnowflakeHost = isSnowflakeHost;
