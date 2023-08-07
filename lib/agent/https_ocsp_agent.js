/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

const SocketUtil = require('./socket_util');
const { Agent } = require('urllib');
const { buildConnector } = require('undici');
const Errors = require('../errors');

function createConnectFunction (connector, mock = undefined) {
  return function connect ({ hostname, host, protocol, port, servername, localAddress, httpSocket }, callback) {
    return connector({ hostname, host, protocol, port, servername, localAddress, httpSocket }, (err, socket) => {
      console.log(`Error is ${err} and socket is ${JSON.stringify(socket)}`);
      if (err) {
        callback(err, socket);
      } else {
        const { socket: secSocket, socketError } = SocketUtil.secureSocket(socket, host, null, mock);
        if (!secSocket.destroyed) {
          callback(err, secSocket);
        } else {
          console.log(`Socket is destroyed ${JSON.stringify(secSocket)} with error ${socketError}`);
          // callback(Errors.createOCSPError(ErrorCodes.ERR_OCSP_REVOKED), null);
          callback(socketError, null);
        }
      }
    });
  };
}

/**
 * Creates a new HttpsOcspAgent.
 *
 * @returns {HttpsOcspAgent}
 * @constructor
 */
function HttpsOcspAgent () {
  const connector = buildConnector({
    maxCachedSessions: 0, // TLS session may be cached and then the wrong one may be used
  });
  return new Agent({ connect: createConnectFunction(connector) });
}

module.exports = HttpsOcspAgent;
