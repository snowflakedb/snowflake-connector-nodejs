/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const GlobalConfig = require('../../../lib/global_config');

const assert = require('assert');

describe('OCSP mode', function () {
  it('getOcspMode', function (done) {
    // insecure mode
    GlobalConfig.setInsecureConnect(true);
    assert.equal(GlobalConfig.getOcspMode(), GlobalConfig.ocspModes.INSECURE);

    // insecure mode + Fail open
    GlobalConfig.setOcspFailOpen(true);
    assert.equal(GlobalConfig.getOcspMode(), GlobalConfig.ocspModes.INSECURE);
    GlobalConfig.setInsecureConnect(false);
    assert.equal(GlobalConfig.getOcspMode(), GlobalConfig.ocspModes.FAIL_OPEN);

    GlobalConfig.setOcspFailOpen(false);
    assert.equal(GlobalConfig.getOcspMode(), GlobalConfig.ocspModes.FAIL_CLOSED);
    GlobalConfig.setOcspFailOpen(true);
    done();
  });
});