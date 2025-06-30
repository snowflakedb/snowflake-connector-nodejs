const HttpsAgent = require('https').Agent;
const SocketUtil = require('../../../lib/agent/socket_util');
const Errors = require('../../../lib/errors');
const ErrorCodes = Errors.codes;

/**
 * HttpsMockAgentOcspRevoked - return revoked error
 * @param options
 * @constructor
 */
function HttpsMockAgentOcspRevoked(options) {
  const agent = HttpsAgent.apply(this, [options]);
  agent.createConnection = function (options) {
    const socket = HttpsAgent.prototype.createConnection.apply(this, arguments);
    return SocketUtil.secureSocket(socket, options.host, null, {
      validateCertChain: function (cert, cb) {
        cb(Errors.createOCSPError(ErrorCodes.ERR_OCSP_REVOKED));
      }
    });
  };
  return agent;
}

/**
 * HttpsMockAgentOcspUnkwown returns unknown error
 * @param options
 * @constructor
 */
function HttpsMockAgentOcspUnkwown(options) {
  const agent = HttpsAgent.apply(this, [options]);
  agent.createConnection = function (options) {
    const socket = HttpsAgent.prototype.createConnection.apply(this, arguments);
    return SocketUtil.secureSocket(socket, options.host, null, {
      validateCertChain: function (cert, cb) {
        cb(Errors.createOCSPError(ErrorCodes.ERR_OCSP_UNKNOWN));
      }
    });
  };
  return agent;
}

/**
 * HttpsMockAgentOcspInvalid returns invalid validity OCSP error
 * @param options
 * @constructor
 */
function HttpsMockAgentOcspInvalid(options) {
  const agent = HttpsAgent.apply(this, [options]);
  agent.createConnection = function (options) {
    const socket = HttpsAgent.prototype.createConnection.apply(this, arguments);
    return SocketUtil.secureSocket(socket, options.host, null, {
      validateCertChain: function (cert, cb) {
        cb(Errors.createOCSPError(ErrorCodes.ERR_OCSP_INVALID_VALIDITY));
      }
    });
  };
  return agent;
}

module.exports = {
  HttpsMockAgentOcspRevoked: HttpsMockAgentOcspRevoked,
  HttpsMockAgentOcspUnkwown: HttpsMockAgentOcspUnkwown,
  HttpsMockAgentOcspInvalid: HttpsMockAgentOcspInvalid
};