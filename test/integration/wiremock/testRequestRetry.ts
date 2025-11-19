import { WireMockRestClient } from 'wiremock-rest-client';
import axios from 'axios';
import assert from 'assert';
import sinon from 'sinon';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../../wiremockRunner';
import * as testUtil from '../testUtil';
import * as Util from '../../../lib/util';
import axiosInstance from '../../../lib/http/axiosInstance';

// TODO: remove this after done debugging
const snowflake = require('../../../lib/snowflake');
snowflake.configure({
  logLevel: 'TRACE',
});

const RETRYABABLE_NETWORK_FAULTS = [
  'EMPTY_RESPONSE',
  'MALFORMED_RESPONSE_CHUNK',
  'RANDOM_DATA_THEN_CLOSE',
  'CONNECTION_RESET_BY_PEER',
];
const RETRYABLE_HTTP_CODES = [408, 429, 500, 503];

// NOTE:
// For every wiremock scenario, we do 4 retries: 3 failures and 1 success.
// This ensures that the full retry flow with backoff is working correctly, as we had bugs
// where the retry would be executed only once.
describe('Request retries', () => {
  let wiremock: WireMockRestClient;
  let port: number;
  let connection: any;
  let axiosRequestSpy: sinon.SinonSpy;

  before(async () => {
    port = await testUtil.getFreePort();
    wiremock = await runWireMockAsync(port);

    // TODO: temporary
    snowflake.configure({
      disableOCSPChecks: true,
    });
  });

  beforeEach(async () => {
    axiosRequestSpy = sinon.spy(axiosInstance, 'request');
    // NOTE:
    // retryTimeout config has 300s minimum, so mock backoff for fast test retries
    sinon
      .stub(Util, 'getJitteredSleepTime')
      .callsFake(
        (
          _numRetries: number,
          _currentSleepTime: number,
          totalElapsedTime: number,
          _maxRetryTimeout: number,
        ) => {
          const sleep = 0.1; // 100ms
          const newTotalElapsedTime = totalElapsedTime + sleep;
          return { sleep, totalElapsedTime: newTotalElapsedTime };
        },
      );

    connection = testUtil.createConnection({
      accessUrl: `http://127.0.0.1:${port}`,
      // TODO: remove before merge
      // proxyHost: '127.0.0.1',
      // proxyPort: 8080,
    });
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/login_request_ok.json');
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/session_delete_ok.json');
  });

  afterEach(async () => {
    sinon.restore();
    await testUtil.destroyConnectionAsync(connection);
    await wiremock.mappings.resetAllMappings();
  });

  after(async () => {
    await wiremock.global.shutdown();
    // TODO: temporary
    snowflake.configure({
      disableOCSPChecks: false,
    });
  });

  function getAxiosRequestsCount(matchingPath: string) {
    return axiosRequestSpy.getCalls().filter((c: any) => c.args?.[0]?.url?.includes(matchingPath))
      .length;
  }

  RETRYABABLE_NETWORK_FAULTS.forEach((responseFault) => {
    it(`Login request retries on network fault=${responseFault}`, async () => {
      await addWireMockMappingsFromFile(
        wiremock,
        'wiremock/mappings/errors/login_request_network_fail.json',
        {
          responseFault,
        },
      );
      await testUtil.connectAsync(connection);
      testUtil.assertConnectionActive(connection);
      assert.strictEqual(getAxiosRequestsCount('/session/v1/login-request'), 4);
    });

    it(`Cancel query retries on network fault=${responseFault}`, async () => {
      await addWireMockMappingsFromFile(
        wiremock,
        'wiremock/mappings/errors/cancel_query_network_fail.json',
        {
          responseFault,
        },
      );
      await testUtil.connectAsync(connection);
      const statement = connection.execute({ sqlText: 'SELECT 1' });
      await new Promise((resolve, reject) => {
        statement.cancel((err: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(null);
          }
        });
      });
      assert.strictEqual(getAxiosRequestsCount('/queries/v1/abort-request'), 4);
    });
  });

  RETRYABLE_HTTP_CODES.forEach((httpStatusCode) => {
    it(`Login request retries on status=${httpStatusCode}`, async () => {
      await addWireMockMappingsFromFile(
        wiremock,
        'wiremock/mappings/errors/login_request_server_fail.json',
        {
          httpStatusCode,
        },
      );
      await testUtil.connectAsync(connection);
      testUtil.assertConnectionActive(connection);
      assert.strictEqual(getAxiosRequestsCount('/session/v1/login-request'), 4);
    });
  });

  // it(`Query request retries on ${fault}`, async () => {
  //   await addWireMockMappingsFromFile(
  //     wiremock,
  //     'wiremock/mappings/network_errors/query_request.json',
  //     {
  //       queryNetworkErrorFault: fault,
  //     },
  //   );
  //   await testUtil.connectAsync(connection);
  //   await testUtil.executeCmdAsync(connection, 'SELECT 1');
  // });

  // it(`Query result retries on ${fault}`, async () => {
  //   await addWireMockMappingsFromFile(
  //     wiremock,
  //     // TODO: put query id as a variable
  //     'wiremock/mappings/network_errors/query_result.json',
  //     {
  //       queryResultNetworkErrorFault: fault,
  //     },
  //   );
  //   await testUtil.connectAsync(connection);
  //   await connection.getResultsFromQueryId({
  //     queryId: '01234567-89ab-cdef-0123-456789abcdef',
  //   });
  // });

  // it(`Query request with large chunks retries chunk download on ${fault}`, async () => {
  //   await addWireMockMappingsFromFile(
  //     wiremock,
  //     'wiremock/mappings/network_errors/query_request_large_chunks.json',
  //     {
  //       wiremockPort: port,
  //       chunkNetworkErrorFault: fault,
  //     },
  //   );
  //   sinon
  //     .stub(Util, 'nextSleepTime')
  //     .callsFake((_base: number, _cap: number, _previousSleep: number) => 0.1);
  //   await testUtil.connectAsync(connection);
  //   const data = await testUtil.executeCmdAsync(connection, 'SELECT 1');
  //   console.log('DATA ----->', data);
  // });
  // });
});
