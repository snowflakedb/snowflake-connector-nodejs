const testUtil = require('./testUtil');
const assert = require('assert');
const httpInterceptorUtils = require('./test_utils/httpInterceptorUtils');
const Core = require('../../lib/core');
const Util = require('../../lib/util');

describe('SF service tests', function () {
  const selectPiTxt = 'select PI();';
  let interceptors;
  let coreInstance;

  before(async function () {
    interceptors = new httpInterceptorUtils.Interceptors();
    const HttpClientClassWithInterceptors = httpInterceptorUtils.getHttpClientWithInterceptorsClass(interceptors);
    coreInstance = Core({
      httpClientClass: HttpClientClassWithInterceptors,
      loggerClass: require('./../../lib/logger/node'),
      client: {
        version: Util.driverVersion,
        name: Util.driverName,
        environment: process.versions,
      },
    });
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
    interceptors.add('request', httpInterceptorUtils.HOOK_TYPE.FOR_ARGS, countCallsWithGuid);

    const connection = testUtil.createConnection({}, coreInstance);
    await testUtil.connectAsync(connection);
    await testUtil.executeCmdAsync(connection, selectPiTxt);

    const guidCallsOccurred = totalCallsWithGUIDCount > 0;
    assert.strictEqual(guidCallsOccurred, true, 'No GUID calls occurred');
    assert.strictEqual(guidAddedWhenExpected, true, `GUID not found in all requests with paths: ${pathsExpectedToIncludeGuid}`);
    assert.strictEqual(expectedCallsWithGUIDCount === totalCallsWithGUIDCount, true, `GUID was added to requests not included in the expected paths: ${pathsExpectedToIncludeGuid}.` +
      `Total calls with guid: ${totalCallsWithGUIDCount}. Expected calls with guid: ${expectedCallsWithGUIDCount}.`
    );

    await testUtil.destroyConnectionAsync(connection);
    interceptors.clear();
  });
});
