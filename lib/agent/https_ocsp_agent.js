/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

const SocketUtil = require('./socket_util');
const { Agent } = require('urllib');
const { buildConnector } = require('undici');

function createConnectFunction (connector, mock = undefined) {
  return function connect ({ hostname, host, protocol, port, servername, localAddress, httpSocket }, callback) {
    return connector({ hostname, host, protocol, port, servername, localAddress, httpSocket }, (err, socket) => {
      if (err) {
        callback(err, socket);
      } else {
        const { socket: secSocket, socketError } = SocketUtil.secureSocket(socket, host, null, mock);
        if (secSocket.destroyed) {
          // Socket has been destroyed by secureSocket function because of OCSP validation
          callback(socketError, null);
        } else {
          callback(null, secSocket);
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
  const connector = buildConnector({});
  return new Agent({ connect: createConnectFunction(connector) });
}

module.exports.createConnectFunction = createConnectFunction;

module.exports.HttpsOcspAgent = HttpsOcspAgent;
