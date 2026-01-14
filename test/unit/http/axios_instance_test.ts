import assert from 'assert';
import sinon from 'sinon';
import { AxiosError, AxiosRequestConfig } from 'axios';
import axios, { SnowflakeInternalAxiosRequestConfig } from '../../../lib/http/axios_instance';
import * as Util from '../../../lib/util';

describe('axios_instance retry middleware', () => {
  let adapterStub: sinon.SinonStub;
  let originalAdapter: typeof axios.defaults.adapter;

  const TEST_REQUEST_CONFIG: AxiosRequestConfig = {
    url: 'http://test.com',
    method: 'GET',
    useSnowflakeRetryMiddleware: true,
  };

  beforeEach(() => {
    originalAdapter = axios.defaults.adapter;
    adapterStub = sinon.stub();
    axios.defaults.adapter = adapterStub;

    // Instantly resolve sleep for faster retries
    sinon.stub(Util, 'sleep').resolves();
  });

  afterEach(() => {
    axios.defaults.adapter = originalAdapter;
    sinon.restore();
  });

  it('passes through successful responses without modification', async () => {
    adapterStub.resolves({ status: 200, data: 'success' });
    const response = await axios.request(TEST_REQUEST_CONFIG);
    assert.strictEqual(response.data, 'success');
    assert.strictEqual(adapterStub.callCount, 1);
  });

  it('skips retry when useSnowflakeRetryMiddleware is not set', async () => {
    adapterStub.rejects({ response: { status: 503 } });
    await assert.rejects(
      axios.request({ ...TEST_REQUEST_CONFIG, useSnowflakeRetryMiddleware: undefined }),
      (err: AxiosError) => {
        assert.strictEqual(err.response?.status, 503);
        return true;
      },
    );
    assert.strictEqual(adapterStub.callCount, 1);
  });

  it('skips retry when config is missing from error', async () => {
    adapterStub.rejects({ message: 'Network Error' });
    await assert.rejects(axios.request(TEST_REQUEST_CONFIG), (err: AxiosError) => {
      assert.strictEqual(err.message, 'Network Error');
      return true;
    });
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
      adapterStub.onFirstCall().callsFake((config: SnowflakeInternalAxiosRequestConfig) => {
        return Promise.reject(
          status
            ? { response: { status }, config, message: `HTTP ${status}` }
            : { config, message: 'ECONNRESET' },
        );
      });
      adapterStub.onSecondCall().callsFake((config: SnowflakeInternalAxiosRequestConfig) => {
        return Promise.resolve({ status: 200, data: 'success', config });
      });
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
      adapterStub.onFirstCall().callsFake((config: SnowflakeInternalAxiosRequestConfig) => {
        return Promise.reject({ response: { status }, config, message: `HTTP ${status}` });
      });
      await assert.rejects(axios.request(TEST_REQUEST_CONFIG), (err: AxiosError) => {
        assert.strictEqual(err.response?.status, status);
        return true;
      });
      assert.strictEqual(adapterStub.callCount, 1);
    });
  });

  it('does not retry on ERR_CANCELED (request canceled by client)', async () => {
    adapterStub.onFirstCall().callsFake((config: SnowflakeInternalAxiosRequestConfig) => {
      return Promise.reject({ config, message: 'canceled', code: 'ERR_CANCELED' });
    });
    await assert.rejects(axios.request(TEST_REQUEST_CONFIG), (err: AxiosError) => {
      assert.strictEqual(err.code, 'ERR_CANCELED');
      return true;
    });
    assert.strictEqual(adapterStub.callCount, 1);
  });

  it('stops retrying after max retries exceeded', async () => {
    adapterStub.callsFake((config: SnowflakeInternalAxiosRequestConfig) => {
      return Promise.reject({ response: { status: 503 }, config, message: 'HTTP 503' });
    });
    await assert.rejects(axios.request(TEST_REQUEST_CONFIG), (err: AxiosError) => {
      assert.strictEqual(err.response?.status, 503);
      return true;
    });
    assert.strictEqual(adapterStub.callCount, 8);
  });
});
