/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

const SocketUtil = require('./socket_util');
const { Agent } = require('urllib');
const ProxyAgent = require('./undici-proxy-agent');
const { buildConnector } = require('undici');

/**
 * Function should be used as connect callback interceptor - before callback is called on received socket OCSP validation is performed
 *
 * @param callback - connect function callback (err, socker) => void
 * @param host host name available via https
 * @param mock additional mock for
 * @return {(function(*, *): void)|*}
 */
const ocspValidationCallback = (callback, host, httpAgent, mock) => (err, socket) => {
  if (err) {
    callback(err, socket);
  } else {
    const { socket: secSocket, socketError } = SocketUtil.secureSocket(socket, host, httpAgent, mock);
    if (secSocket.destroyed) {
      // Socket has been destroyed by secureSocket function because of OCSP validation
      callback(socketError, null);
    } else {
      callback(null, secSocket);
    }
  }
}

function createConnectFunction (connector, mock = undefined) {
  return function connect ({ hostname, host, protocol, port, servername, localAddress, httpSocket }, callback) {
    return connector({ hostname, host, protocol, port, servername, localAddress, httpSocket }, ocspValidationCallback(callback, host, null, mock));
  };
}

/**
 * Creates a new HttpsOcspAgent.
 *
 * @returns {Agent}
 * @constructor
 */
function HttpsOcspAgent (options) {
  const connector = buildConnector({});
  return new Agent({
    ...options,
    connect: createConnectFunction(connector)
  });
}

/**
 * Creates a new ProxyHttpsOcspAgent.
 *
 * @returns {ProxyAgent}
 * @constructor
 */
function ProxyHttpsOcspAgent (options) {
  return new ProxyAgent({
    ...options,
    ocspValidationCallback,
  });
}

module.exports.createConnectFunction = createConnectFunction;

module.exports.HttpsOcspAgent = HttpsOcspAgent;

module.exports.ProxyHttpsOcspAgent = ProxyHttpsOcspAgent;
