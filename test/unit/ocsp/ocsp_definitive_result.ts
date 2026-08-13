import assert from 'assert';
import GlobalConfig from '../../../lib/global_config';
import untypedSocketUtil from '../../../lib/agent/socket_util';
import Errors from '../../../lib/errors';

const ErrorCodes = Errors.codes;

const SocketUtil = untypedSocketUtil as unknown as {
  canEarlyExitForOCSP: (errors: (Error | null)[]) => (Error & { code: number }) | null;
};

describe('OCSP definitive result is authoritative in fail-open', () => {
  it('signature verification failure is fatal even in fail-open', () => {
    const errors = [Errors.createOCSPError(ErrorCodes.ERR_OCSP_INVALID_SIGNATURE), null];
    {
      GlobalConfig.setOcspFailOpen(true);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.ok(err, 'expected the signature failure to be honored in fail-open');
      assert.equal(err.code, ErrorCodes.ERR_OCSP_INVALID_SIGNATURE);
    }
    {
      GlobalConfig.setOcspFailOpen(false);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.equal(err!.code, ErrorCodes.ERR_OCSP_INVALID_SIGNATURE);
    }
  });

  it('response/certificate mismatch is fatal even in fail-open', () => {
    const errors = [Errors.createOCSPError(ErrorCodes.ERR_OCSP_RESPONSE_CERT_MISMATCH), null];
    {
      GlobalConfig.setOcspFailOpen(true);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.ok(err, 'expected the certificate mismatch to be honored in fail-open');
      assert.equal(err.code, ErrorCodes.ERR_OCSP_RESPONSE_CERT_MISMATCH);
    }
    {
      GlobalConfig.setOcspFailOpen(false);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.equal(err!.code, ErrorCodes.ERR_OCSP_RESPONSE_CERT_MISMATCH);
    }
  });

  it('an unreachable responder is still tolerated under fail-open', () => {
    const errors = [Errors.createOCSPError(ErrorCodes.ERR_OCSP_RESPONDER_TIMEOUT), null];
    {
      GlobalConfig.setOcspFailOpen(true);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.ok(!err, 'expected an unreachable responder to be tolerated in fail-open');
    }
    {
      GlobalConfig.setOcspFailOpen(false);
      const err = SocketUtil.canEarlyExitForOCSP(errors);
      assert.equal(err!.code, ErrorCodes.ERR_OCSP_RESPONDER_TIMEOUT);
    }
  });

  it('a signature failure is honored even alongside a soft error, in fail-open', () => {
    const errors = [
      Errors.createOCSPError(ErrorCodes.ERR_OCSP_INVALID_SIGNATURE),
      Errors.createOCSPError(ErrorCodes.ERR_OCSP_NO_RESPONSE),
      null,
    ];
    GlobalConfig.setOcspFailOpen(true);
    const err = SocketUtil.canEarlyExitForOCSP(errors);
    assert.ok(err, 'expected the signature failure to take precedence over the soft error');
    assert.equal(err.code, ErrorCodes.ERR_OCSP_INVALID_SIGNATURE);
  });

  it('a signature failure is honored regardless of error ordering, in fail-open', () => {
    // The soft error appears first; the definitive result must still win.
    const errors = [
      Errors.createOCSPError(ErrorCodes.ERR_OCSP_NO_RESPONSE),
      Errors.createOCSPError(ErrorCodes.ERR_OCSP_INVALID_SIGNATURE),
      null,
    ];
    GlobalConfig.setOcspFailOpen(true);
    const err = SocketUtil.canEarlyExitForOCSP(errors);
    assert.ok(err, 'expected the signature failure to take precedence irrespective of order');
    assert.equal(err.code, ErrorCodes.ERR_OCSP_INVALID_SIGNATURE);
  });
});
