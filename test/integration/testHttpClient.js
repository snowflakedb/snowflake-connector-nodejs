const connOptions = require('../integration/connectionOptions');
const ConnectionConfig = require('../../lib/connection/connection_config');
const NodeHttpClient = require('../../lib/http/node').NodeHttpClient;
const { hangWebServerUrl } = require('../hangWebserver');
const assert = require('assert');
const testUtil = require('./testUtil');

describe('HttpClient Specialized Tests', () => {
  let httpClientInstance;

  const connectionOptions = {
    ...(connOptions.valid),
    timeout: 100000
  };

  const httpConnectionOptions = new ConnectionConfig(connectionOptions, false, false, {
    version: '1',
    environment: process.versions,
  });

  beforeEach(() => {
    httpClientInstance = new NodeHttpClient(httpConnectionOptions);
  });

  describe('Aborting requests', () => {
    it('should allow aborting any request immediately', async () => {
      const requestObject = httpClientInstance.request({
        url: hangWebServerUrl + '/hang',
        method: 'GET',
        callback: (err) => {
          // We expect an error due to aborting the request.
          if (err) {
            testUtil.isRequestCancelledError(err);
            assert.equal(err.message, 'canceled');
            assert.equal(err.name, 'CanceledError');
            assert.equal(err.code, 'ERR_CANCELED');
          } else {
            throw Error('Expected an error from aborted request, but got success.');
          }
        }
      });

      // Abort the request immediately
      requestObject.abort();
      await requestObject.requestPromise;
    });

    it('should allow aborting long-running request after some time', async () => {
      const TIME_IN_MS_TO_WAIT_BEFORE_ABORT = 2000;
      assert.ok(TIME_IN_MS_TO_WAIT_BEFORE_ABORT < connectionOptions.timeout, 'Test was not set up correctly. ' +
          'To test correctly the aborting functionality it should be triggered before timeout of the request itself');

      const requestObject = httpClientInstance.request({
        url: hangWebServerUrl + '/hang',
        method: 'GET',
        callback: (err) => {
          // We expect an error due to aborting the request.
          if (err) {
            testUtil.isRequestCancelledError(err);
          } else {
            throw Error('Expected an error from aborted request, but got success.');
          }
        }
      });

      // Abort the request after some time
      await testUtil.sleepAsync(TIME_IN_MS_TO_WAIT_BEFORE_ABORT);
      requestObject.abort();
      await requestObject.requestPromise;
    });
  });

  describe('Ensuring normalizeResponse is called for requestAsync', () => {
    it('should return a normalized response with statusCode and body', async () => {
      const testUrl = hangWebServerUrl + '/json';

      const response = await httpClientInstance.requestAsync({
        url: testUrl,
        method: 'GET'
      });

      assert.ok(response, 'Response should be defined');
      assert.ok(response.statusCode, 'Normalized response should have statusCode');
      assert.ok(response.body, 'Normalized response should have body');
    });
  });
});
