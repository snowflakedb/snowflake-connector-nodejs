/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

const HttpsAgent = require('urllib').Agent;
const Util = require('../../../lib/util');
const SocketUtil = require('../../../lib/agent/socket_util');
const Errors = require('../../../lib/errors');
const {buildConnector} = require('undici');
const {Agent} = require('urllib');
const ErrorCodes = Errors.codes;

/**
 * HttpsMockAgentOcspRevoked - return revoked error
 * @param options
 * @constructor
 */

// TODO : SNOW-876346 - Refactor creating of mock agents.
function HttpsMockAgentOcspRevoked() {
  function connect({ hostname, host, protocol, port, servername, localAddress, httpSocket }, callback) {
    const socket = connector({ hostname, host, protocol, port, servername, localAddress, httpSocket }, callback);
    return SocketUtil.secureSocket(socket, host, null, {
      validateCertChain: function (cert, cb) {
        cb(Errors.createOCSPError(ErrorCodes.ERR_OCSP_REVOKED));
      }
    });
  }
  let connector;
  let agent;
  if (!connector) {
    connector = buildConnector({timeout:100000});
  }

  if (!agent) {
    agent = new Agent({connect});
  }
  return agent;
}

/**
 * HttpsMockAgentOcspUnkwown returns unknown error
 * @param options
 * @constructor
 */
function HttpsMockAgentOcspUnkwown(options) {
  function connect({ hostname, host, protocol, port, servername, localAddress, httpSocket }, callback) {
    const socket = connector({ hostname, host, protocol, port, servername, localAddress, httpSocket }, callback);
    return SocketUtil.secureSocket(socket, host, null, {
      validateCertChain: function (cert, cb){
        cb(Errors.createOCSPError(ErrorCodes.ERR_OCSP_UNKNOWN));
      }
    });
  }
  let connector;
  let agent;
  if (!connector) {
    connector = buildConnector({timeout:100000});
  }

  if (!agent) {
    agent = new Agent({connect});
  }
  return agent;
}

/**
 * HttpsMockAgentOcspInvalid returns invalid validity OCSP error
 * @param options
 * @constructor
 */
function HttpsMockAgentOcspInvalid(options) {
  function connect({ hostname, host, protocol, port, servername, localAddress, httpSocket }, callback) {
    const socket = connector({ hostname, host, protocol, port, servername, localAddress, httpSocket }, callback);
    return SocketUtil.secureSocket(socket, host, null, {
      validateCertChain: function (cert, cb) {
        cb(Errors.createOCSPError(ErrorCodes.ERR_OCSP_INVALID_VALIDITY));
      }
    });
  }
  let connector;
  let agent;
  if (!connector) {
    connector = buildConnector({timeout:100000});
  }

  if (!agent) {
    agent = new Agent({connect});
  }
  return agent;

}

module.exports = {
  HttpsMockAgentOcspRevoked: HttpsMockAgentOcspRevoked,
  HttpsMockAgentOcspUnkwown: HttpsMockAgentOcspUnkwown,
  HttpsMockAgentOcspInvalid: HttpsMockAgentOcspInvalid
};