const GlobalConfig = require('../../../lib/global_config');
const SocketUtil = require('../../../lib/agent/socket_util');
const Errors = require('../../../lib/errors');
const ErrorCodes = Errors.codes;

const assert = require('assert');

describe('OCSP early exist error', function () {
  it('canEarlyExitForOCSP - no error', function (done) {
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
    done();
  });

  it('canEarlyExitForOCSP - revoked', function (done) {
    const errors = [
      Errors.createOCSPError(ErrorCodes.ERR_OCSP_REVOKED),
      null
    ];
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
    done();
  });

  it('canEarlyExitForOCSP - unknown', function (done) {
    const errors = [
      Errors.createOCSPError(ErrorCodes.ERR_OCSP_UNKNOWN),
      null
    ];
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
    done();
  });

  it('canEarlyExitForOCSP - revoked and other errors', function (done) {
    const errors = [
      Errors.createOCSPError(ErrorCodes.ERR_OCSP_REVOKED),
      Errors.createOCSPError(ErrorCodes.ERR_OCSP_NO_RESPONSE),
      null
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
    done();
  });

  it('canEarlyExitForOCSP - unknown and other errors', function (done) {
    const errors = [
      Errors.createOCSPError(ErrorCodes.ERR_OCSP_UNKNOWN),
      Errors.createOCSPError(ErrorCodes.ERR_OCSP_INVALID_SIGNATURE)
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
    done();
  });

  it('canEarlyExitForOCSP - invalid ocsp response', function (done) {
    const errors = [
      Errors.createOCSPError(ErrorCodes.ERR_OCSP_NO_SIGNATURE_ALGORITHM),
      Errors.createOCSPError(ErrorCodes.ERR_OCSP_NO_RESPONSE),
      null
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
    done();
  });
});