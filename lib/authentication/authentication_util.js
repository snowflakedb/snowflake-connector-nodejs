const net = require('net');
const querystring = require('querystring');

const { exists, format, escapeHTML } = require('../util');
const Logger = require('../logger');
const GlobalConfig = require('../global_config');

const HTML_RESPONSE_HEADERS =
  'HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nConnection: close\r\n\r\n';
const MAX_CALLBACK_HEADER_SIZE = 64 * 1024;
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
 * @param {{
 *   renderer?: (result: { error: string | null }) => string,
 *   allowedOrigin?: string
 * }} [options]
 *
 * @returns {Server}
 */
function createServer(resolve, reject, options = {}) {
  const renderer = options.renderer || defaultRenderer;
  const allowedOrigin = options.allowedOrigin ? new URL(options.allowedOrigin) : null;
  const server = net.createServer(function (socket) {
    let request = '';
    let completed = false;
    socket.on('data', function (chunk) {
      try {
        if (completed) {
          return;
        }
        request += chunk.toString();
        if (!allowedOrigin) {
          completeCallback(request.split('\r\n')[0], null);
          return;
        }

        const parsedRequest = parseCallbackRequest(request);
        if (!parsedRequest) {
          if (request.length > MAX_CALLBACK_HEADER_SIZE) {
            socket.destroy();
          }
          return;
        }

        const originValues = parsedRequest.headers.get('origin') || [];
        const origin = getSingleHeader(parsedRequest.headers, 'origin');
        if (parsedRequest.method.toUpperCase() === 'OPTIONS') {
          const requestedMethod = getSingleHeader(
            parsedRequest.headers,
            'access-control-request-method',
          );
          if (
            originMatches(origin, allowedOrigin) &&
            requestedMethod?.toUpperCase() === 'POST' &&
            requestedPreflightHeadersAllowed(parsedRequest.headers)
          ) {
            socket.end(createPreflightResponse(origin), 'utf8');
          } else {
            socket.destroy();
          }
          return;
        }

        const originlessGet =
          parsedRequest.method.toUpperCase() === 'GET' &&
          (originValues.length === 0 ||
            (originValues.length === 1 && origin.toLowerCase() === 'null'));
        if (!originlessGet && !originMatches(origin, allowedOrigin)) {
          socket.destroy();
          return;
        }

        if (!isRequestBodyComplete(parsedRequest)) {
          return;
        }

        const hasError = parsedRequest.requestLine.includes('?error=');
        const token = extractCallbackToken(parsedRequest);
        if (!token && !hasError) {
          socket.destroy();
          return;
        }

        completeCallback(
          requestLineForResolvedToken(parsedRequest, token),
          originlessGet ? null : origin,
        );
        return;
      } catch (err) {
        // Any synchronous failure while processing the redirect (e.g. a throwing
        // renderer, or a malformed error redirect) must reject the promise
        // rather than escape to the event loop as an uncaughtException.
        socket.destroy();
        server.close();
        reject(err);
      }
    });

    function completeCallback(requestLine, corsOrigin) {
      if (completed) {
        return;
      }
      completed = true;
      const error = requestLine.includes('?error=') ? prepareError(requestLine) : null;
      const body = renderer({ error: error ? escapeHTML(error) : null });
      const headers = corsOrigin
        ? createCallbackResponseHeaders(corsOrigin)
        : HTML_RESPONSE_HEADERS;

      socket.write(`${headers}${body}`, 'utf8');
      socket.destroy();
      server.close();

      if (error) {
        Logger.getInstance().trace(`Error during authorization: ${error}`);
        reject(error);
      } else {
        Logger.getInstance().trace('User successfully entered authorization code');
        resolve(requestLine);
      }
    }

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

function findHeaderSectionEnd(request) {
  let headerEnd = -1;
  let separator = '';
  for (const candidate of ['\r\n\r\n', '\n\n', '\r\n\n', '\n\r\n']) {
    const index = request.indexOf(candidate);
    if (index >= 0 && (headerEnd < 0 || index < headerEnd)) {
      headerEnd = index;
      separator = candidate;
    }
  }
  return headerEnd < 0 ? null : { headerEnd, separator };
}

function parseCallbackRequest(request) {
  const headerSection = findHeaderSectionEnd(request);
  if (!headerSection) {
    return null;
  }

  const { headerEnd, separator } = headerSection;
  const lines = request.substring(0, headerEnd).split(/\r?\n/);
  const requestLine = lines.shift() || '';
  const method = requestLine.split(/\s+/, 1)[0];
  const headers = new Map();
  for (const line of lines) {
    const colon = line.indexOf(':');
    if (colon < 0) {
      continue;
    }
    const name = line.substring(0, colon).trim().toLowerCase();
    const value = line.substring(colon + 1).trim();
    const values = headers.get(name) || [];
    values.push(value);
    headers.set(name, values);
  }
  return {
    requestLine,
    method,
    headers,
    body: request.substring(headerEnd + separator.length),
  };
}

function isRequestBodyComplete(parsedRequest) {
  const raw = getSingleHeader(parsedRequest.headers, 'content-length');
  if (raw == null) {
    return true;
  }
  const contentLength = Number.parseInt(raw, 10);
  if (!Number.isFinite(contentLength) || contentLength <= 0) {
    return true;
  }
  return Buffer.byteLength(parsedRequest.body, 'utf8') >= contentLength;
}

function extractQueryParam(requestLine, name) {
  const path = requestLine.split(/\s+/)[1] || '';
  const queryStart = path.indexOf('?');
  if (queryStart < 0) {
    return null;
  }
  const value = querystring.parse(path.substring(queryStart + 1))[name];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function extractTokenFromPostBody(body) {
  const trimmed = body.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const payload = JSON.parse(trimmed);
    if (payload && typeof payload.token === 'string' && payload.token.length > 0) {
      return payload.token;
    }
  } catch {
    // JSON.parse rejects form-encoded bodies; fall through to token=.
  }
  const value = querystring.parse(trimmed).token;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function extractCallbackToken(parsedRequest) {
  const queryToken = extractQueryParam(parsedRequest.requestLine, 'token');
  if (queryToken) {
    return queryToken;
  }
  if (parsedRequest.method.toUpperCase() !== 'POST') {
    return null;
  }
  return extractTokenFromPostBody(parsedRequest.body);
}

function requestLineForResolvedToken(parsedRequest, token) {
  if (!token || extractQueryParam(parsedRequest.requestLine, 'token')) {
    return parsedRequest.requestLine;
  }
  const version = parsedRequest.requestLine.split(/\s+/)[2] || 'HTTP/1.1';
  return `${parsedRequest.method} /?token=${encodeURIComponent(token)} ${version}`;
}

function getSingleHeader(headers, name) {
  const values = headers.get(name);
  return values?.length === 1 ? values[0] : null;
}

function requestedPreflightHeadersAllowed(headers) {
  const values = headers.get('access-control-request-headers') || [];
  if (values.length === 0) {
    return true;
  }
  if (values.length > 1) {
    return false;
  }
  return values[0]
    .split(',')
    .map((header) => header.trim())
    .filter((header) => header.length > 0)
    .every((header) => header.toLowerCase() === 'content-type');
}

function originMatches(origin, allowedOrigin) {
  if (!origin || origin.toLowerCase() === 'null' || /[@?#]/.test(origin)) {
    return false;
  }
  try {
    const requestedOrigin = new URL(origin);
    return (
      requestedOrigin.origin === allowedOrigin.origin &&
      requestedOrigin.username === '' &&
      requestedOrigin.password === '' &&
      requestedOrigin.pathname === '/'
    );
  } catch {
    return false;
  }
}

function createPreflightResponse(origin) {
  return (
    'HTTP/1.1 200 OK\r\n' +
    'Access-Control-Allow-Methods: POST\r\n' +
    'Access-Control-Allow-Headers: Content-Type\r\n' +
    `Access-Control-Allow-Origin: ${origin}\r\n` +
    'Vary: Origin\r\n' +
    'Connection: close\r\n\r\n'
  );
}

function createCallbackResponseHeaders(origin) {
  return (
    'HTTP/1.1 200 OK\r\n' +
    'Content-Type: text/html; charset=utf-8\r\n' +
    `Access-Control-Allow-Origin: ${origin}\r\n` +
    'Vary: Origin\r\n' +
    'Connection: close\r\n\r\n'
  );
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
