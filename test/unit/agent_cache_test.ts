import assert from 'assert';
import { getProxyAgent, getAgentCacheSize } from './../../lib/http/node';
import { WIP_ConnectionConfig } from '../../lib/connection/types';
import * as GlobalConfig from './../../lib/global_config';

describe('getProxtAgent', function () {
  const mockProxy = new URL('https://user:pass@myproxy.server.com:1234');
  const fakeAccessUrl = new URL('http://fakeaccount.snowflakecomputing.com');

  const testCases = [
    {
      destination: 'test.destination.com',
      isNewAgent: true,
      keepAlive: true,
    },
    {
      destination: '://test.destination.com',
      isNewAgent: true,
      keepAlive: true,
    },
    {
      destination: 'This is not a URL',
      isNewAgent: true,
      keepAlive: true,
    },
    {
      destination: 's4.amazonaws.com',
      isNewAgent: true,
      keepAlive: true,
    },
    {
      destination: 'http://test.destination.com/login/somewhere',
      isNewAgent: false,
      keepAlive: true,
    },
    {
      destination: 'http://s4.amazonaws.com',
      isNewAgent: false,
      keepAlive: true,
    },
    {
      destination: 'https://s4.amazonaws.com',
      isNewAgent: true,
      keepAlive: false,
    },
    {
      destination: 'https://test.destination.com/login/somewhere',
      isNewAgent: true,
      keepAlive: false,
    },
    {
      destination: 'https://fakeaccounttesting.snowflakecomputing.com/login/sessionId=something',
      isNewAgent: true,
      keepAlive: true,
    },
    {
      destination: 'https://fakeaccounttesting.snowflakecomputing.com/other/request',
      isNewAgent: false,
      keepAlive: true,
    },
    {
      destination: 'http://fakeaccounttesting.snowflakecomputing.com/another/request',
      isNewAgent: true,
      keepAlive: false,
    },
  ];

  it('test http(s) agent cache', () => {
    let numofAgent = getAgentCacheSize();
    testCases.forEach(({ destination, isNewAgent, keepAlive }) => {
      GlobalConfig.setKeepAlive(keepAlive);
      getProxyAgent({
        proxyOptions: mockProxy,
        parsedUrl: fakeAccessUrl,
        destination,
        connectionConfig: {
          crlValidatorConfig: {
            checkMode: 'DISABLED',
          },
        } as WIP_ConnectionConfig,
      });
      if (isNewAgent) {
        numofAgent++;
      }
      assert.strictEqual(getAgentCacheSize(), numofAgent);
    });
  });
});
