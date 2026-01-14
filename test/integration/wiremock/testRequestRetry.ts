import { WireMockRestClient } from 'wiremock-rest-client';
import assert from 'assert';
import sinon from 'sinon';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../../wiremockRunner';
import * as testUtil from '../testUtil';
import * as Util from '../../../lib/util';
import axiosInstance from '../../../lib/http/axios_instance';

const RETRYABLE_REQUEST_FAULTS = [
  'EMPTY_RESPONSE',
  'MALFORMED_RESPONSE_CHUNK',
  'RANDOM_DATA_THEN_CLOSE',
  'CONNECTION_RESET_BY_PEER',
  408, // Request Timeout
  429, // Too Many Requests
  500, // Internal Server Error
  503, // Service Unavailable
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

  function registerRetryMappings(requestFault: string | number, mappingsName: string) {
    const isHttpError = typeof requestFault === 'number';
    const fileSuffix = isHttpError ? 'http_fail' : 'network_fail';
    return addWireMockMappingsFromFile(
      wiremock,
      `wiremock/mappings/request_retries/${mappingsName}_${fileSuffix}.json`,
      {
        replaceVariables: isHttpError
          ? { httpStatusCode: requestFault }
          : { responseFault: requestFault },
      },
    );
  }

  for (const requestFault of RETRYABLE_REQUEST_FAULTS) {
    it(`cancel query retries on ${requestFault}`, async () => {
      await registerRetryMappings(requestFault, 'cancel_query');
      await testUtil.connectAsync(connection);
      const statement = connection.execute({ sqlText: 'SELECT 1' });
      await new Promise((resolve, reject) => {
        statement.cancel((err: any) => (err ? reject(err) : resolve(null)));
      });
      assert.strictEqual(getAxiosRequestsCount('/queries/v1/abort-request'), 4);
    });
  }
});
