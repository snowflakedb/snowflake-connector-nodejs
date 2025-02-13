const GlobalConfig = require('../../../lib/global_config');

const assert = require('assert');

describe('OCSP mode', function () {
  it('getOcspMode', function (done) {
    // insecure mode
    GlobalConfig.setDisableOCSPChecks(true);
    assert.equal(GlobalConfig.getOcspMode(), GlobalConfig.ocspModes.INSECURE);

    // insecure mode + Fail open
    GlobalConfig.setOcspFailOpen(true);
    assert.equal(GlobalConfig.getOcspMode(), GlobalConfig.ocspModes.INSECURE);
    GlobalConfig.setDisableOCSPChecks(false);
    assert.equal(GlobalConfig.getOcspMode(), GlobalConfig.ocspModes.FAIL_OPEN);

    GlobalConfig.setOcspFailOpen(false);
    assert.equal(GlobalConfig.getOcspMode(), GlobalConfig.ocspModes.FAIL_CLOSED);
    GlobalConfig.setOcspFailOpen(true);
    done();
  });
});