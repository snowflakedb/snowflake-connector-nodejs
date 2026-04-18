import assert from 'assert';
import { WireMockRestClient } from 'wiremock-rest-client';
import { WIP_ConnectionOptions } from '../../../lib/connection/types';
import * as testUtil from '../testUtil';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../../wiremockRunner';
import { getFreePort } from '../../../lib/util';

/*
 * This test doesn't cover all potential unhandled rejection leaks in statement.js,
 * but it covers the one we don't have control over - malformed server responses that cause
 * the Result constructor to throw.
 *
 * The whole statement.js needs a refactor, but it's not feasible due to the upcoming
 * Universal Driver migration.
 *
 * Adding as a safeguard until UD replaces the code.
 */
describe('SELECT 1 receiving response with missing rowset', function () {
  let wiremock: WireMockRestClient;
  let connectionConfig: WIP_ConnectionOptions;

  before(async () => {
    const port = await getFreePort();
    wiremock = await runWireMockAsync(port);
    connectionConfig = {
      account: 'test-account',
      accessUrl: `http://127.0.0.1:${port}`,
    };
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/login_request_ok.json');
    // - First request (POST /queries/v1/query-request) fails Result construction due to missing rowset (null)
    // - Driver retries using the result endpoint (GET /queries/{queryId}/result)
    // - Second request also crashes due to the same malformed response
    // - Driver gives up and returns the error to the caller
    await addWireMockMappingsFromFile(
      wiremock,
      'wiremock/mappings/query_result_missing_rowset.json',
    );
  });

  after(async () => {
    await wiremock.global.shutdown();
  });

  it('returns runtime error', async function () {
    const connection = testUtil.createConnection(connectionConfig);
    await testUtil.connectAsync(connection);
    try {
      await testUtil.executeCmdAsync(connection, 'SELECT 1');
    } catch (err: unknown) {
      assert.match((err as Error).message, /Cannot read properties of null/);
    }
  });
});
