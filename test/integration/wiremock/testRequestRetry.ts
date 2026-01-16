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
      const statement = connection.execute({ sqlText: 'SELECT 1' });
      await new Promise((resolve) => statement.cancel(resolve));
      assert.strictEqual(getAxiosRequestsCount('/queries/v1/abort-request'), expectedRequestCount);
    });

    it.skip(`cancel query with id ${expectedActionText}`);
    it.skip(`query request retries on ${expectedActionText}`);
    it.skip(`fetch query result retries on ${expectedActionText}`);
    it.skip(`pending query getResultUrl retries on ${expectedActionText}`);
  }
});
