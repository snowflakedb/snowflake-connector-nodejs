const connOptions = require('../integration/connectionOptions');
const ConnectionConfig = require('../../lib/connection/connection_config');
const NodeHttpClient = require('../../lib/http/node').NodeHttpClient;
const { hangWebServerUrl } = require('../hangWebserver');
const assert = require('assert');
const testUtil = require('./testUtil');

describe('HttpClient Tests', () => {
  let httpClientInstance;

  const connectionOptions = {
    ...(connOptions.valid),
    timeout: 2000
  };

  const httpConnectionOptions = new ConnectionConfig(connectionOptions, false, false, {
    version: '1',
    environment: process.versions,
  });

  beforeEach(() => {
    httpClientInstance = new NodeHttpClient(httpConnectionOptions);
  });

  describe('Aborting requests', () => {
    const urlReturningResponseAfterHanging = hangWebServerUrl + '/hang';

    it('should allow aborting any request immediately', async () => {
      let errorFromCallback;

      const requestObject = httpClientInstance.request({
        url: urlReturningResponseAfterHanging,
        method: 'GET',
        callback: (err) => {
          // We expect an error due to aborting the request.
          if (err) {
            testUtil.isRequestCancelledError(err);
          } else {
            errorFromCallback = Error('Expected an error from aborted request, but got success.');
          }
        }
      });

      // Abort the request immediately
      requestObject.abort();

      //Due to usage of 'nextTick' in the httpClient requestPromise may be undefined for some time, only to be set when scheduled sending took place.
      await testUtil.waitForCondition(() => requestObject.requestPromise);
      await requestObject.requestPromise;

      assert.ok(!errorFromCallback, `Did not receive a normalized response. Error: ${errorFromCallback}`);
    });

    it('should allow aborting long-running request after some time', async () => {
      let errorFromCallback;
      const TIME_IN_MS_TO_WAIT_BEFORE_ABORT = 1500;
      assert.ok(TIME_IN_MS_TO_WAIT_BEFORE_ABORT < connectionOptions.timeout, 'Test was not set up correctly. ' +
          'To test correctly the aborting functionality it should be triggered before timeout of the request itself');

      const requestObject = httpClientInstance.request({
        url: urlReturningResponseAfterHanging,
        method: 'GET',
        callback: (err) => {
          // We expect an error due to aborting the request.
          if (err) {
            testUtil.isRequestCancelledError(err);
          } else {
            errorFromCallback = Error('Expected an error from aborted request, but got success.');
          }
        }
      });

      // Abort the request after some time
      await testUtil.sleepAsync(TIME_IN_MS_TO_WAIT_BEFORE_ABORT);
      requestObject.abort();

      //Due to usage of 'nextTick' in the httpClient requestPromise may be undefined for some time, only to be set when scheduled sending took place.
      await testUtil.waitForCondition(() => requestObject.requestPromise);
      await requestObject.requestPromise;

      assert.ok(!errorFromCallback, `Did not receive a normalized response. Error: ${errorFromCallback}`);
    });
  });

  describe('Normalizing Response', () => {
    const urlReturningJsonBody = hangWebServerUrl + '/json';

    it('should return a normalized response with statusCode and body for requestAsync', async () => {
      const response = await httpClientInstance.requestAsync({
        url: urlReturningJsonBody,
        method: 'GET'
      });

      assert.ok(response, 'Response should be defined');
      assert.ok(response.statusCode, 'Normalized response should have statusCode');
      assert.ok(response.body, 'Normalized response should have body');
    });

    it('should return a normalized response with statusCode and body for synchronous request', async () => {
      let errorRaisedInCallback;

      const requestObject = httpClientInstance.request({
        url: urlReturningJsonBody,
        method: 'GET',
        callback: (err, response) => {
          try {
            assert.ok(response, 'Response should be defined');
            assert.ok(response.statusCode, 'Normalized response should have statusCode');
            assert.ok(response.body, 'Normalized response should have body');
          } catch (assertionError) {
            errorRaisedInCallback = assertionError;
          }
        }
      });
      //Due to usage of 'nextTick' in the httpClient requestPromise may be undefined for some time, only to be set when scheduled sending took place.
      await testUtil.waitForCondition(() => requestObject.requestPromise);
      await requestObject.requestPromise;

      assert.ok(!errorRaisedInCallback, `Did not receive a normalized response. Error: ${errorRaisedInCallback}`);
    });
  });
});
