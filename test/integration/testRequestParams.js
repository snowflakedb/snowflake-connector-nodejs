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
    // TODO: this may cause flaky test
    snowflake.configure({ httpClientClass: NodeHttpClient });
  });

  it('GUID called for all', async function () {
    let guidAddedWhenExpected = true;
    let totalCallsWithGUIDCount = 0;
    let expectedCallsWithGUIDCount = 0;
    const pathsExpectedToIncludeGuid = [
      'session?delete=true&requestId',
      'queries/v1/query-request',
      'session/v1/login-request'
    ];

    function countCallsWithGuid(requestOptions) {
      pathsExpectedToIncludeGuid.forEach((value) => {
        if (requestOptions.url.includes(value)) {
          // Counting is done instead of assertions, because we do not want to interrupt
          // the flow of operations inside the HttpClient. Retries and other custom exception handling could be triggered.
          if (!testUtil.isGuidInRequestOptions(requestOptions)) {
            guidAddedWhenExpected = false;
          }
          expectedCallsWithGUIDCount++;
        }
      });
      
      if (testUtil.isGuidInRequestOptions(requestOptions)) {
        totalCallsWithGUIDCount++;
      }
    }
    interceptors['request'] = { args: countCallsWithGuid };

    const connection = testUtil.createConnection();
    await testUtil.connectAsync(connection);
    await testUtil.executeCmdAsync(connection, selectPiTxt);

    const guidCallsOccurred = totalCallsWithGUIDCount > 0;
    assert.strictEqual(guidCallsOccurred, true, 'No GUID calls occurred');
    assert.strictEqual(guidAddedWhenExpected, true, `GUID not found in all requests with paths: ${pathsExpectedToIncludeGuid}`);
    assert.strictEqual(expectedCallsWithGUIDCount === totalCallsWithGUIDCount, true, `GUID was added to requests not included in the expected paths: ${pathsExpectedToIncludeGuid}.` +
      `Total calls with guid: ${totalCallsWithGUIDCount}. Expected calls with guid: ${expectedCallsWithGUIDCount}.`
    );

    await testUtil.destroyConnectionAsync(connection);
  });

});
