import assert from 'assert';
import { WireMockRestClient } from 'wiremock-rest-client';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../../wiremockRunner';
import * as testUtil from '../testUtil';
import { getFreePort } from '../../../lib/util';

function gsResponse(body: object, extra: object = {}) {
  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    jsonBody: { code: null, message: null, success: true, ...body },
    ...extra,
  };
}

describe('Session renewal failures', function () {
  let wiremock: WireMockRestClient;
  let connectionConfig: any;

  before(async () => {
    const port = await getFreePort();
    wiremock = await runWireMockAsync(port);
    connectionConfig = {
      account: 'test-account',
      accessUrl: `http://127.0.0.1:${port}`,
    };
  });

  beforeEach(async () => {
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/login_request_ok.json');
  });

  afterEach(async () => {
    await wiremock.mappings.resetAllMappings();
    await wiremock.requests.deleteAllRequests();
  });

  after(async () => {
    await wiremock.global.shutdown();
  });

  async function mockQueryRequestSessionExpiredFail(sqlText: string, extra: object = {}) {
    await wiremock.mappings.createMapping({
      request: {
        method: 'POST',
        urlPathPattern: '/queries/v1/query-request.*',
        bodyPatterns: [{ contains: sqlText }],
      },
      response: {
        ...gsResponse({
          data: null,
          code: '390112',
          message: 'Your session has expired. Please login again.',
          success: false,
        }),
        ...extra,
      },
    });
  }

  async function mockTokenRequestMasterExpiredFail() {
    await wiremock.mappings.createMapping({
      request: { method: 'POST', urlPathPattern: '/session/token-request.*' },
      response: gsResponse({
        data: null,
        code: '390114',
        message: 'Authentication token has expired. The user must authenticate again.',
        success: false,
      }),
    });
  }

  it('does not restart renewal when a late session expired response arrives after renewal failed', async function () {
    // Both queries are sent with the expired session token. The second one answers later
    // (e.g. a larger request body), after the renewal triggered by the first one has failed.
    await mockQueryRequestSessionExpiredFail('SELECT 1');
    await mockQueryRequestSessionExpiredFail('SELECT 2', { fixedDelayMilliseconds: 1000 });
    await mockTokenRequestMasterExpiredFail();

    const connection = testUtil.createConnection(connectionConfig);
    await testUtil.connectAsync(connection);

    await Promise.allSettled([
      testUtil.executeCmdAsync(connection, 'SELECT 1'),
      testUtil.executeCmdAsync(connection, 'SELECT 2'),
    ]);

    const { count } = await wiremock.requests.getCount({
      method: 'POST',
      urlPathPattern: '/session/token-request.*',
    });
    assert.strictEqual(count, 1, 'expected a single renewal request');
    testUtil.assertConnectionInactive(connection);
  });

  it('fails query with master token expired error when session can no longer be renewed', async function () {
    await mockQueryRequestSessionExpiredFail('SELECT 1');
    await mockTokenRequestMasterExpiredFail();

    const connection = testUtil.createConnection(connectionConfig);
    await testUtil.connectAsync(connection);

    await assert.rejects(testUtil.executeCmdAsync(connection, 'SELECT 1'), (err: any) => {
      assert.strictEqual(err.code, '390114');
      return true;
    });
    testUtil.assertConnectionInactive(connection);
  });
});
