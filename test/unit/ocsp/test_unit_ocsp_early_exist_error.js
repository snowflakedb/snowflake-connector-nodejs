const assert = require('assert');
const SocketUtil = require('../../../lib/agent/socket_util');
const Errors = require('../../../lib/errors');
const ErrorCodes = Errors.codes;
const { resetOcspState, enableOcsp } = require('../../ocspTestState');

describe('OCSP early exist error', function () {
  afterEach(resetOcspState);

  it('canEarlyExitForOCSP - no error', function (done) {
    const errors = [null, null, null];
    {
      enableOcsp(true);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.ok(!err);
    }
    {
      enableOcsp(false);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.ok(!err);
    }
    done();
  });

  it('canEarlyExitForOCSP - revoked', function (done) {
    const errors = [Errors.createOCSPError(ErrorCodes.ERR_OCSP_REVOKED), null];
    {
      enableOcsp(true);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.equal(err.code, ErrorCodes.ERR_OCSP_REVOKED);
    }
    {
      enableOcsp(false);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.equal(err.code, ErrorCodes.ERR_OCSP_REVOKED);
    }
    done();
  });

  it('canEarlyExitForOCSP - unknown', function (done) {
    const errors = [Errors.createOCSPError(ErrorCodes.ERR_OCSP_UNKNOWN), null];
    {
      enableOcsp(true);
      // revoked
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.ok(!err);
    }
    {
      enableOcsp(false);
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
      null,
    ];
    {
      enableOcsp(true);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.ok(!err);
    }
    {
      enableOcsp(false);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.equal(err.code, ErrorCodes.ERR_OCSP_REVOKED);
    }
    done();
  });

  it('canEarlyExitForOCSP - unknown and other errors', function (done) {
    const errors = [
      Errors.createOCSPError(ErrorCodes.ERR_OCSP_UNKNOWN),
      Errors.createOCSPError(ErrorCodes.ERR_OCSP_INVALID_SIGNATURE),
    ];
    {
      enableOcsp(true);
      // A signature that did not verify is a definitive result and is honored
      // even in fail-open mode.
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.equal(err.code, ErrorCodes.ERR_OCSP_INVALID_SIGNATURE);
    }
    {
      enableOcsp(false);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.equal(err.code, ErrorCodes.ERR_OCSP_UNKNOWN);
    }
    done();
  });

  it('canEarlyExitForOCSP - invalid ocsp response', function (done) {
    const errors = [
      Errors.createOCSPError(ErrorCodes.ERR_OCSP_NO_SIGNATURE_ALGORITHM),
      Errors.createOCSPError(ErrorCodes.ERR_OCSP_NO_RESPONSE),
      null,
    ];
    {
      enableOcsp(true);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.ok(!err);
    }
    {
      enableOcsp(false);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.equal(err.code, ErrorCodes.ERR_OCSP_NO_SIGNATURE_ALGORITHM);
    }
    done();
  });
});
