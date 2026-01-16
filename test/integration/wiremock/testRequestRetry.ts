import { WireMockRestClient } from 'wiremock-rest-client';
import assert from 'assert';
import sinon from 'sinon';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../../wiremockRunner';
import * as testUtil from '../testUtil';
import * as Util from '../../../lib/util';
import axiosInstance from '../../../lib/http/axios_instance';

const REQUEST_ERRORS = [
  // Retryable faults
  { error: 'EMPTY_RESPONSE', shouldRetry: true },
  { error: 'MALFORMED_RESPONSE_CHUNK', shouldRetry: true },
  { error: 'RANDOM_DATA_THEN_CLOSE', shouldRetry: true },
  { error: 'CONNECTION_RESET_BY_PEER', shouldRetry: true },
  { error: 408, shouldRetry: true }, // Request Timeout
  { error: 429, shouldRetry: true }, // Too Many Requests
  { error: 500, shouldRetry: true }, // Internal Server Error
  { error: 503, shouldRetry: true }, // Service Unavailable
  // Non-retryable faults
  { error: 400, shouldRetry: false }, // Bad Request
  { error: 401, shouldRetry: false }, // Unauthorized
  { error: 403, shouldRetry: false }, // Forbidden
  { error: 404, shouldRetry: false }, // Not Found
];

describe('Request Retries', () => {
  let wiremock: WireMockRestClient;
  let port: number;
  let axiosRequestSpy: sinon.SinonSpy;
  let connection: any;

  before(async () => {
    port = await testUtil.getFreePort();
    wiremock = await runWireMockAsync(port);
  });

  beforeEach(async () => {
    axiosRequestSpy = sinon.spy(axiosInstance, 'request');

    // Instantly resolve sleep for faster retries
    sinon.stub(Util, 'sleep').resolves();

    connection = testUtil.createConnection({
      accessUrl: `http://127.0.0.1:${port}`,
    });
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/login_request_ok.json');
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/session_delete_ok.json');
  });

  afterEach(async () => {
    sinon.restore();
    if (connection.isUp()) {
      await testUtil.destroyConnectionAsync(connection);
    }
    await wiremock.mappings.resetAllMappings();
  });

  after(async () => {
    await wiremock.global.shutdown();
  });

  function getAxiosRequestsCount(matchingPath: string) {
    return axiosRequestSpy.getCalls().filter((c: any) => c.args?.[0]?.url?.includes(matchingPath))
      .length;
  }

  function registerRetryMappings(requestError: string | number, mappingsName: string) {
    const isHttpError = typeof requestError === 'number';
    const fileSuffix = isHttpError ? 'http_fail' : 'network_fail';
    return addWireMockMappingsFromFile(
      wiremock,
      `wiremock/mappings/request_retries/${mappingsName}_${fileSuffix}.json`,
      {
        replaceVariables: isHttpError
          ? { httpStatusCode: requestError }
          : { responseFault: requestError },
      },
    );
  }

  for (const { error, shouldRetry } of REQUEST_ERRORS) {
    const expectedActionText = `${shouldRetry ? 'retries' : 'does not retry'} on ${error}`;
    const expectedRequestCount = shouldRetry ? 4 : 1;

    it(`cancel query without id ${expectedActionText}`, async () => {
      await registerRetryMappings(error, 'cancel_query');
      await testUtil.connectAsync(connection);

      // NOTE:
      // .cancel() doesn't abort pending query-request. We need to wait for it to complete
      // before cleaning up wiremock. Otherwise, query-request gets stuck in retry loop.
      let markStatementCompleted: (value: unknown) => void;
      const statementDonePromise = new Promise((resolve) => (markStatementCompleted = resolve));
      const statement = connection.execute({
        sqlText: 'SELECT 1',
        complete: () => markStatementCompleted(true),
      });

      await new Promise((resolve) => statement.cancel(resolve));
      await statementDonePromise;
      assert.strictEqual(getAxiosRequestsCount('/queries/v1/abort-request'), expectedRequestCount);
    });

    it(`cancel query with id ${expectedActionText}`, async () => {
      await registerRetryMappings(error, 'cancel_query_byid');
      await testUtil.connectAsync(connection);
      const { rowStatement } = await testUtil.executeCmdAsyncWithAdditionalParameters(
        connection,
        'SELECT 1',
        {
          asyncExec: true,
        },
      );
      await new Promise((resolve) => rowStatement.cancel(resolve));
      assert.strictEqual(
        getAxiosRequestsCount('/queries/01baf79b-0108-1a60-0000-01110354a6ce/abort-request'),
        expectedRequestCount,
      );
    });

    it(`query request ${expectedActionText}`, async () => {
      await registerRetryMappings(error, 'query_request');
      await testUtil.connectAsync(connection);
      await testUtil.executeCmdAsyncWithAdditionalParameters(connection, 'SELECT 1', {
        asyncExec: true,
      });
      assert.strictEqual(getAxiosRequestsCount('/queries/v1/query-request'), expectedRequestCount);
    });

    it(`fetch result ${expectedActionText}`, async () => {
      await registerRetryMappings(error, 'query_result');
      await testUtil.connectAsync(connection);
      await new Promise((resolve) => {
        connection.fetchResult({
          queryId: '01baf79b-0108-1a60-0000-01110354a6ce',
          complete: () => resolve(true),
        });
      });
      // NOTE:
      // When result fetching fails:
      // ↓ the statement completes with an error
      // ↓ transitions to completed state
      // ↓ context.refresh() is called
      // ↓ this invokes request 1 more time
      //
      // Seems like a bug. Keeping as is until universal driver migration.
      assert.strictEqual(
        getAxiosRequestsCount('/queries/01baf79b-0108-1a60-0000-01110354a6ce/result'),
        shouldRetry ? 4 : 2,
      );
    });

    it(`query returning getResultUrl ${expectedActionText}`, async () => {
      await addWireMockMappingsFromFile(
        wiremock,
        'wiremock/mappings/query_returns_get_result_url.json',
      );
      await registerRetryMappings(error, 'query_result');
      await testUtil.connectAsync(connection);
      await new Promise((resolve) => {
        connection.execute({
          sqlText: 'SELECT 1',
          complete: () => resolve(true),
        });
      });
      // NOTE:
      // When result fetching fails:
      // ↓ the statement completes with an error
      // ↓ transitions to completed state
      // ↓ context.refresh() is called
      // ↓ this invokes request 1 more time
      //
      // Seems like a bug. Keeping as is until universal driver migration.
      assert.strictEqual(
        getAxiosRequestsCount('/queries/01baf79b-0108-1a60-0000-01110354a6ce/result'),
        shouldRetry ? 4 : 2,
      );
    });
  }
});
