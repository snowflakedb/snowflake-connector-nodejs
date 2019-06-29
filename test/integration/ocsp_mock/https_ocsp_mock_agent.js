/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

const HttpsAgent = require('https').Agent;
const Util = require('../../../lib/util');
const SocketUtil = require('../../../lib/agent/socket_util');
const Errors = require('../../../lib/errors');
const ErrorCodes = Errors.codes;

/**
 * HttpsMockAgentOcspRevoked - return revoked error
 * @param options
 * @constructor
 */
function HttpsMockAgentOcspRevoked(options)
{
  return HttpsAgent.apply(this, arguments);
}

Util.inherits(HttpsMockAgentOcspRevoked, HttpsAgent);

HttpsMockAgentOcspRevoked.prototype.createConnection = function (options)
{
  const socket = HttpsAgent.prototype.createConnection.apply(this, arguments);
  return SocketUtil.secureSocket(socket, options.host, {
    validateCertChain: function (cert, cb)
    {
      cb(Errors.createOCSPError(ErrorCodes.ERR_OCSP_REVOKED));
    }
  });
};

/**
 * HttpsMockAgentOcspUnkwown returns unknown error
 * @param options
 * @constructor
 */
function HttpsMockAgentOcspUnkwown(options)
{
  return HttpsAgent.apply(this, arguments);
}

Util.inherits(HttpsMockAgentOcspUnkwown, HttpsAgent);

HttpsMockAgentOcspUnkwown.prototype.createConnection = function (options)
{
  const socket = HttpsAgent.prototype.createConnection.apply(this, arguments);
  return SocketUtil.secureSocket(socket, options.host, {
    validateCertChain: function (cert, cb)
    {
      cb(Errors.createOCSPError(ErrorCodes.ERR_OCSP_UNKNOWN));
    }
  });
};

/**
 * HttpsMockAgentOcspInvalid returns invalid validity OCSP error
 * @param options
 * @constructor
 */
function HttpsMockAgentOcspInvalid(options)
{
  return HttpsAgent.apply(this, arguments);
}

Util.inherits(HttpsMockAgentOcspInvalid, HttpsAgent);

HttpsMockAgentOcspInvalid.prototype.createConnection = function (options)
{
  const socket = HttpsAgent.prototype.createConnection.apply(this, arguments);
  return SocketUtil.secureSocket(socket, options.host, {
    validateCertChain: function (cert, cb)
    {
      cb(Errors.createOCSPError(ErrorCodes.ERR_OCSP_INVALID_VALIDITY));
    }
  });
};

module.exports = {
  HttpsMockAgentOcspRevoked: HttpsMockAgentOcspRevoked,
  HttpsMockAgentOcspUnkwown: HttpsMockAgentOcspUnkwown,
  HttpsMockAgentOcspInvalid: HttpsMockAgentOcspInvalid
};
