/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const testUtil = require('./testUtil');
const assert = require('node:assert');
const snowflake = require('../../lib/snowflake');
const { NodeHttpClient } = require('../../lib/http/node');

describe('SF service tests', async function () {
  const selectPiTxt = 'select PI();';
  const interceptors = {};

  before(async function () {
    const HttpClientClassWithInterceptors = testUtil.getHttpClientWithInterceptorsClass(interceptors);
    snowflake.configure({ httpClientClass: HttpClientClassWithInterceptors });
  });
  
  after(async function () {
    // TODO: this may cause flaky tests
    snowflake.configure({ httpClientClass: NodeHttpClient });
  });
  
  it('GUID called for all', async function (done) {
    const EXPECTED_GUID_CALLS_NUMBER = 3;
    let callsWithGUIDCount = 0;

    function countCallsWithGuid(urlObject) {
      if (urlObject.url.includes('request_guid') || 'request_guid' in urlObject.params) {
        callsWithGUIDCount++;
      }
    }
    interceptors['request'] = { args: countCallsWithGuid };


    const connection = testUtil.createConnection();
    await testUtil.connectAsync(connection);
    await testUtil.executeCmdAsync(connection, selectPiTxt);

    assert.strictEqual(callsWithGUIDCount, EXPECTED_GUID_CALLS_NUMBER);
    done();
  });
});
