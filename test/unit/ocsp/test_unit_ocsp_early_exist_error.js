const GlobalConfig = require('../../../lib/global_config');
const SocketUtil = require('../../../lib/agent/socket_util');
const Errors = require('../../../lib/errors');
const ErrorCodes = Errors.codes;

const assert = require('assert');

describe('OCSP early exist error', function () {
  it('canEarlyExitForOCSP - no error', function () {
    const errors = [null, null, null];
    {
      GlobalConfig.setOcspFailOpen(true);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.ok(!err);
    }
    {
      GlobalConfig.setOcspFailOpen(false);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.ok(!err);
    }
  });

  it('canEarlyExitForOCSP - revoked', function () {
    const errors = [Errors.createOCSPError(ErrorCodes.ERR_OCSP_REVOKED), null];
    {
      GlobalConfig.setOcspFailOpen(true);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.equal(err.code, ErrorCodes.ERR_OCSP_REVOKED);
    }
    {
      GlobalConfig.setOcspFailOpen(false);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.equal(err.code, ErrorCodes.ERR_OCSP_REVOKED);
    }
  });

  it('canEarlyExitForOCSP - unknown', function () {
    const errors = [Errors.createOCSPError(ErrorCodes.ERR_OCSP_UNKNOWN), null];
    {
      GlobalConfig.setOcspFailOpen(true);
      // revoked
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.ok(!err);
    }
    {
      GlobalConfig.setOcspFailOpen(false);
      // revoked
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.equal(err.code, ErrorCodes.ERR_OCSP_UNKNOWN);
    }
  });

  it('canEarlyExitForOCSP - revoked and other errors', function () {
    const errors = [
      Errors.createOCSPError(ErrorCodes.ERR_OCSP_REVOKED),
      Errors.createOCSPError(ErrorCodes.ERR_OCSP_NO_RESPONSE),
      null,
    ];
    {
      GlobalConfig.setOcspFailOpen(true);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.ok(!err);
    }
    {
      GlobalConfig.setOcspFailOpen(false);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.equal(err.code, ErrorCodes.ERR_OCSP_REVOKED);
    }
  });

  it('canEarlyExitForOCSP - unknown and other errors', function () {
    const errors = [
      Errors.createOCSPError(ErrorCodes.ERR_OCSP_UNKNOWN),
      Errors.createOCSPError(ErrorCodes.ERR_OCSP_INVALID_SIGNATURE),
    ];
    {
      GlobalConfig.setOcspFailOpen(true);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.ok(!err);
    }
    {
      GlobalConfig.setOcspFailOpen(false);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.equal(err.code, ErrorCodes.ERR_OCSP_UNKNOWN);
    }
  });

  it('canEarlyExitForOCSP - invalid ocsp response', function () {
    const errors = [
      Errors.createOCSPError(ErrorCodes.ERR_OCSP_NO_SIGNATURE_ALGORITHM),
      Errors.createOCSPError(ErrorCodes.ERR_OCSP_NO_RESPONSE),
      null,
    ];
    {
      GlobalConfig.setOcspFailOpen(true);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.ok(!err);
    }
    {
      GlobalConfig.setOcspFailOpen(false);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.equal(err.code, ErrorCodes.ERR_OCSP_NO_SIGNATURE_ALGORITHM);
    }
  });
});
