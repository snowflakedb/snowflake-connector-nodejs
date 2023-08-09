/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

const Errors = require('../../../lib/errors');
const { buildConnector } = require('undici');
const { Agent } = require('urllib');
const { createConnectFunction } = require('../../../lib/agent/https_ocsp_agent');
const ErrorCodes = Errors.codes;

function createMockWithFailingValidateCertChain (errorCode) {
  return {
    validateCertChain: function (cert, cb) {
      cb(Errors.createOCSPError(errorCode));
    }
  };
}

function createMockedAgentFailingOnValidateCertChain (errorCode) {
  return () => {
    const connector = buildConnector({});
    return new Agent({
      connect: createConnectFunction(connector, createMockWithFailingValidateCertChain(errorCode)),
    });
  };
}

module.exports = {
  HttpsMockAgentOcspRevoked: createMockedAgentFailingOnValidateCertChain(ErrorCodes.ERR_OCSP_REVOKED),
  HttpsMockAgentOcspUnkwown: createMockedAgentFailingOnValidateCertChain(ErrorCodes.ERR_OCSP_UNKNOWN),
  HttpsMockAgentOcspInvalid: createMockedAgentFailingOnValidateCertChain(ErrorCodes.ERR_OCSP_INVALID_VALIDITY),
};
