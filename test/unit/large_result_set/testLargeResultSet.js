const connOptions = require('../../integration/connectionOptions');
const LargeResultSetService = require('../../../lib/services/large_result_set');

const httpClient = require('../../../lib/http/node').NodeHttpClient;
const ConnectionConfig = require('../../../lib/connection/connection_config');
const { hangWebServerUrl } = require('../../hangWebserver');
const http = require('http');

// Check if hang webserver is available synchronously before running tests
let serverAvailable = null;
async function checkServerAvailability() {
  if (serverAvailable !== null) {
    return serverAvailable;
  }
  serverAvailable = await new Promise((resolve) => {
    const req = http.get(hangWebServerUrl + '/json', { timeout: 1000 }, (res) => {
      resolve(true);
      res.destroy();
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
  return serverAvailable;
}

// Helper to promisify callback-based methods
function promisifyGetObject(service, options) {
  return new Promise((resolve, reject) => {
    service.getObject({
      ...options,
      callback: (err, body) => {
        if (err) {
          reject(err);
        } else {
          resolve(body);
        }
      },
    });
  });
}

function promisifyRequest(client, options) {
  return new Promise((resolve, reject) => {
    client.request({
      ...options,
      callback: (err, body) => {
        if (err) {
          reject(err);
        } else {
          resolve(body);
        }
      },
    });
  });
}

describe('LargeResultSetService', () => {
  let httpClientInstance;
  let largeResultSetService;

  // it's python hang webserver address to test retries and errors
  const baseUrl = hangWebServerUrl;

  beforeAll(async () => {
    const available = await checkServerAvailability();
    if (!available) {
      // eslint-disable-next-line no-console
      console.log(
        'Hang webserver not available at ' + hangWebServerUrl + ', tests will be skipped',
      );
    }
  });

  beforeEach(async (context) => {
    const available = await checkServerAvailability();
    if (!available) {
      context.skip();
      return;
    }
    const connectionOptions = {
      ...connOptions.valid,
      timeout: 100,
    };

    const httpConnectionOptions = new ConnectionConfig(connectionOptions, false, false, {
      version: '1',
      environment: process.versions,
    });

    // let's override internal configuration for retries to not wait too long
    httpConnectionOptions.getRetryLargeResultSetMaxNumRetries = () => 2;
    httpConnectionOptions.getRetryLargeResultSetMaxSleepTime = () => 0;

    httpClientInstance = new httpClient(httpConnectionOptions);
    largeResultSetService = new LargeResultSetService(httpConnectionOptions, httpClientInstance);
  });

  describe('when all retries fail', () => {
    [
      { testName: 'should retry on 503', url: '/503', expectedErrorName: 'LargeResultSetError' },
      { testName: 'should retry on timeout', url: '/hang', expectedErrorName: 'NetworkError' },
    ].forEach(({ testName, url, expectedErrorName }) => {
      it(testName, async () => {
        try {
          await promisifyGetObject(largeResultSetService, { url: baseUrl + url });
          throw new Error('expected error');
        } catch (err) {
          if (err.name !== expectedErrorName) {
            throw new Error(`Expected ${expectedErrorName} but received ${JSON.stringify(err)}`);
          }
        }
      });
    });
  });

  describe('when recover at last try', () => {
    beforeEach(async () => {
      await promisifyRequest(httpClientInstance, {
        url: baseUrl + '/resetCounter',
        method: 'POST',
      });
    });

    [
      { testName: 'should recover from 503', url: '/eachThirdReturns200Others503' },
      { testName: 'should recover from timeout', url: '/eachThirdReturns200OthersHang' },
    ].forEach(({ testName, url }) => {
      it(testName, async () => {
        await promisifyGetObject(largeResultSetService, { url: baseUrl + url });
      });
    });
  });

  it('should fail on xml content', async () => {
    try {
      const body = await promisifyGetObject(largeResultSetService, { url: baseUrl + '/xml' });
      throw new Error(`Error expected but received body ${body}`);
    } catch (err) {
      if (err.name !== 'LargeResultSetError') {
        throw err;
      }
    }
  });
});
