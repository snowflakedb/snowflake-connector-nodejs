/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

const SocketUtil = require('../../../lib/agent/socket_util');
const Errors = require('../../../lib/errors');
const { buildConnector } = require('undici');
const { Agent } = require('urllib');
const ErrorCodes = Errors.codes;

function createMockedAgentFailingOnValidateCertChain(errorCode) {
  function createConnectFunction (connector, errorCode) {
    return function connect ({ hostname, host, protocol, port, servername, localAddress, httpSocket }, callback) {
      console.log(`Calling connect with ${hostname}, ${host}, ${protocol}, ${port}, ${servername}, ${localAddress}, ${httpSocket}`)
      return connector({ hostname, host, protocol, port, servername, localAddress, httpSocket }, (err, socket) => {
        console.log(`Error is ${err} and socket is ${JSON.stringify(socket)}`);
        if(err){
          callback(err, socket);
        }else {
          // let socketError;
          // socket.on('error', err => {
          //   // event handle run after returned socket from secureSocket
          //   socketError = err;
          // })
          const {socket: secSocket, socketError } = SocketUtil.secureSocket(socket, host, null, {
            // There is the most important part where we are overriding mock
            validateCertChain: function (cert, cb) {
              cb(Errors.createOCSPError(errorCode));
            }
          });
          if(!secSocket.destroyed) {
            callback(err, secSocket);
          } else {
            console.log(`Socket is destroyed ${JSON.stringify(secSocket)} with error ${socketError}`)
            // callback(Errors.createOCSPError(ErrorCodes.ERR_OCSP_REVOKED), null);
            callback(socketError, null);
          }
        }
      });
    };
  }

  return () => {
    const connector = buildConnector({
      // maxCachedSessions: 0,
    });
    console.log("Creating agent...")
    return new Agent({
      connect: createConnectFunction(connector, errorCode),
    });
  };
}

module.exports = {
  HttpsMockAgentOcspRevoked: createMockedAgentFailingOnValidateCertChain(ErrorCodes.ERR_OCSP_REVOKED),
  HttpsMockAgentOcspUnkwown: createMockedAgentFailingOnValidateCertChain(ErrorCodes.ERR_OCSP_UNKNOWN),
  HttpsMockAgentOcspInvalid: createMockedAgentFailingOnValidateCertChain(ErrorCodes.ERR_OCSP_INVALID_VALIDITY),
};