const connOptions = require('../../integration/connectionOptions');
const LargeResultSetService = require('../../../lib/services/large_result_set');

const httpClient = require('../../../lib/http/node');
const ConnectionConfig = require('../../../lib/connection/connection_config');
const { hangWebServerUrl } = require('../../hangWebserver');

describe('LargeResultSetService', () =>
{
  let httpClientInstance;
  let largeResultSetService;

  // it's python hang webserver address to test retries and errors
  const baseUrl = hangWebServerUrl;

  beforeEach(() =>
  {
    const connectionOptions = {
      ...(connOptions.valid),
      timeout: 100,
    };

    const httpConnectionOptions = new ConnectionConfig(connectionOptions, false, false, {
      version: '1',
      environment: process.versions,
    });


    // let's override internal configuration for retries to not wait too long
    httpConnectionOptions.getRetryLargeResultSetMaxNumRetries = () => 2;
    httpConnectionOptions.getRetryLargeResultSetMaxSleepTime = () => 0;

    httpClientInstance = new httpClient(httpConnectionOptions)
    largeResultSetService = new LargeResultSetService(httpConnectionOptions, httpClientInstance);
  });

  describe('when all retries fail', () =>
  {
    [
      {testName: 'should retry on 503', url: '/503', expectedErrorName: 'LargeResultSetError'},
      {testName: 'should retry on timeout', url: '/hang', expectedErrorName: 'NetworkError'},
    ].forEach(({testName, url, expectedErrorName}) =>
    {
      it(testName, done =>
      {
        largeResultSetService.getObject({
          url: baseUrl + url,
          callback: (err, body) =>
          {
            if (err)
            {
              if (err && err.name === expectedErrorName)
              {
                done()
              }
              else
              {
                done(`Expected ${expectedErrorName} but received ${JSON.stringify(err)}`)
              }
            }
            else
            {
              done('expected error')
            }
          }
        });
      });
    });
  });

  describe('when recover at last try', () =>
  {
    beforeEach(done =>
    {
      httpClientInstance.request({
        url: baseUrl + '/resetCounter',
        method: 'POST',
        callback: err => done(err)
      });
    });

    [
      {testName: 'should recover from 503', url: '/eachThirdReturns200Others503'},
      {testName: 'should recover from timeout', url: '/eachThirdReturns200OthersHang'},
    ].forEach(({testName, url}) =>
    {
      it(testName, done =>
      {
        largeResultSetService.getObject({
          url: baseUrl + url,
          callback: (err) =>
          {
            done(err);
          }
        });
      });
    });
  });

  it('should fail on xml content', done => {
    largeResultSetService.getObject({
      url: baseUrl + '/xml',
      callback: (err, body) =>
      {
        err && err.name === 'LargeResultSetError' ? done() : done(`Error expected but received body ${body}`)
      }
    });
  });
});