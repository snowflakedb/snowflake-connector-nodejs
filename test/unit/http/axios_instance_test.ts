import assert from 'assert';
import sinon from 'sinon';
import { AxiosError, AxiosRequestConfig } from 'axios';
import axios, { SnowflakeInternalAxiosRequestConfig } from '../../../lib/http/axios_instance';
import * as Util from '../../../lib/util';

describe('axios_instance retry middleware', () => {
  let adapterStub: sinon.SinonStub;
  let originalAdapter: typeof axios.defaults.adapter;

  const TEST_REQUEST_CONFIG: AxiosRequestConfig = {
    url: 'http://snowflake.com',
    method: 'GET',
    useSnowflakeRetryMiddleware: true,
  };

  const FIXED_TIMESTAMP = Date.now();

  beforeEach(() => {
    originalAdapter = axios.defaults.adapter;
    adapterStub = sinon.stub();
    axios.defaults.adapter = adapterStub;

    // Instantly resolve sleep for faster retries
    sinon.stub(Util, 'sleep').resolves();
    // Fix Date.now() for predictable clientStartTime
    sinon.stub(Date, 'now').returns(FIXED_TIMESTAMP);
  });

  afterEach(() => {
    axios.defaults.adapter = originalAdapter;
    sinon.restore();
  });

  /**
   * Mocks axios response with optional failures before success.
   * @param failure - HTTP status (e.g. 503) or network error code (e.g. 'ECONNRESET')
   * @param repeatTimes - Number of failures before success
   * @returns Array capturing all request URLs for assertions
   */
  function createMockAdapter(failure?: number | string, repeatTimes: number = 1) {
    const capturedUrls: string[] = [];
    const failures: (number | string)[] =
      failure !== undefined ? Array(repeatTimes).fill(failure) : [];

    adapterStub.callsFake((config: SnowflakeInternalAxiosRequestConfig) => {
      capturedUrls.push(config.url!);
      const currentFailure = failures.shift();
      if (currentFailure === undefined) {
        return Promise.resolve({ status: 200, data: 'success', config });
      }
      return Promise.reject(
        typeof currentFailure === 'number'
          ? { response: { status: currentFailure }, config, message: `HTTP ${currentFailure}` }
          : { config, message: currentFailure, code: currentFailure },
      );
    });

    return capturedUrls;
  }

  it('passes through successful responses without modification', async () => {
    createMockAdapter();
    const response = await axios.request(TEST_REQUEST_CONFIG);
    assert.strictEqual(response.data, 'success');
    assert.strictEqual(adapterStub.callCount, 1);
  });

  it('skips retry when useSnowflakeRetryMiddleware is not set', async () => {
    createMockAdapter(503);
    await assert.rejects(
      axios.request({ ...TEST_REQUEST_CONFIG, useSnowflakeRetryMiddleware: undefined }),
      (err: AxiosError) => {
        assert.strictEqual(err.response?.status, 503);
        return true;
      },
    );
    assert.strictEqual(adapterStub.callCount, 1);
  });

  [
    { status: 408, description: 'Request Timeout' },
    { status: 429, description: 'Too Many Requests' },
    { status: 500, description: 'Internal Server Error' },
    { status: 503, description: 'Service Unavailable' },
    { status: null, description: 'Network Error' },
  ].forEach(({ status, description }) => {
    it(`retries on HTTP:${status} (${description})`, async () => {
      createMockAdapter(status ?? 'ECONNRESET');
      const response = await axios.request(TEST_REQUEST_CONFIG);
      assert.strictEqual(response.data, 'success');
      assert.strictEqual(adapterStub.callCount, 2);
    });
  });

  [
    { status: 400, description: 'Bad Request' },
    { status: 401, description: 'Unauthorized' },
    { status: 403, description: 'Forbidden' },
    { status: 404, description: 'Not Found' },
  ].forEach(({ status, description }) => {
    it(`does not retry on HTTP:${status} (${description})`, async () => {
      createMockAdapter(status);
      await assert.rejects(axios.request(TEST_REQUEST_CONFIG), (err: AxiosError) => {
        assert.strictEqual(err.response?.status, status);
        return true;
      });
      assert.strictEqual(adapterStub.callCount, 1);
    });
  });

  it('does not retry on ERR_CANCELED (request canceled by client)', async () => {
    createMockAdapter('ERR_CANCELED');
    await assert.rejects(axios.request(TEST_REQUEST_CONFIG), (err: AxiosError) => {
      assert.strictEqual(err.code, 'ERR_CANCELED');
      return true;
    });
    assert.strictEqual(adapterStub.callCount, 1);
  });

  it('stops retrying after max retries exceeded', async () => {
    createMockAdapter(503, 10);
    await assert.rejects(
      axios.request({
        ...TEST_REQUEST_CONFIG,
        snowflakeRetryConfig: { maxRetries: 5 },
      }),
      (err: AxiosError) => {
        assert.strictEqual(err.response?.status, 503);
        return true;
      },
    );
    assert.strictEqual(adapterStub.callCount, 6);
  });

  it('adds clientStartTime and retryCount to query parameters on retries', async () => {
    const capturedUrls = createMockAdapter(503, 2);
    await axios.request({
      ...TEST_REQUEST_CONFIG,
      url: 'http://snowflake.com/?queryParam=true',
    });
    const initialUrl = new URL(capturedUrls[0]);
    const retry1Url = new URL(capturedUrls[1]);
    const retry2Url = new URL(capturedUrls[2]);
    assert.strictEqual(initialUrl.toString(), 'http://snowflake.com/?queryParam=true');
    assert.strictEqual(
      retry1Url.toString(),
      `http://snowflake.com/?queryParam=true&clientStartTime=${FIXED_TIMESTAMP}&retryCount=1`,
    );
    assert.strictEqual(
      retry2Url.toString(),
      `http://snowflake.com/?queryParam=true&clientStartTime=${FIXED_TIMESTAMP}&retryCount=2`,
    );
  });

  [
    { failure: 503, expectedRetryReason: '503' },
    { failure: 'ECONNRESET', expectedRetryReason: '0' },
  ].forEach(({ failure, expectedRetryReason }) => {
    it('adds retryReason to query parameters when includeRetryReason is true', async () => {
      const capturedUrls = createMockAdapter(failure);
      await axios.request({
        ...TEST_REQUEST_CONFIG,
        snowflakeRetryConfig: { includeRetryReason: true },
      });
      const retryUrl = new URL(capturedUrls[1]);
      assert.strictEqual(retryUrl.searchParams.get('retryReason'), expectedRetryReason);
    });
  });
});
