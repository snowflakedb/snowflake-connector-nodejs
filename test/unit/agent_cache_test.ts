import assert from 'assert';
import { getProxyAgent, httpsAgentCache } from './../../lib/http/node';
import { WIP_ConnectionConfig } from '../../lib/connection/types';
import * as GlobalConfig from './../../lib/global_config';
import HttpsProxyAgent from './../../lib/agent/https_proxy_agent';

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
      destination: 'test.destination.com',
      isNewAgent: true,
      keepAlive: true,
      crlCheckMode: 'ENABLED',
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
    let numofAgent = httpsAgentCache.size;
    testCases.forEach(({ destination, isNewAgent, keepAlive, crlCheckMode }) => {
      GlobalConfig.setKeepAlive(keepAlive);
      getProxyAgent({
        proxyOptions: mockProxy,
        parsedUrl: fakeAccessUrl,
        destination,
        connectionConfig: {
          crlValidatorConfig: {
            checkMode: crlCheckMode ?? 'DISABLED',
          },
        } as WIP_ConnectionConfig,
      });
      if (isNewAgent) {
        numofAgent++;
      }
      assert.strictEqual(httpsAgentCache.size, numofAgent);
    });
  });
});

describe('getProxyAgent - noProxy bypass with full request URLs', function () {
  const connectionConfig = {
    crlValidatorConfig: { checkMode: 'DISABLED' },
  } as WIP_ConnectionConfig;

  const proxyWithNoProxy = {
    host: 'my.pro.xy',
    port: 8080,
    protocol: 'http:',
    noProxy: '*.snowflakecomputing.com',
  };

  beforeEach(() => {
    httpsAgentCache.clear();
  });

  // The destination passed to getProxyAgent in production is the full request URL
  // (parsedUrl.href), including the path and query string. The bypass check must
  // still extract the bare hostname so noProxy matches; otherwise the anchored
  // regex never matches a URL ending in a path and the proxy is wrongly used.
  it('bypasses proxy for full request URL matching noProxy', () => {
    const parsedUrl = new URL(
      'https://myorg-myaccount.privatelink.snowflakecomputing.com/session/v1/login-request?requestId=abc',
    );
    const agent = getProxyAgent({
      proxyOptions: proxyWithNoProxy,
      parsedUrl,
      destination: parsedUrl.href,
      connectionConfig,
    });
    assert.ok(
      !(agent instanceof HttpsProxyAgent),
      'Expected NOT to use a proxy agent for a bypassed host, but a proxy agent was returned',
    );
  });

  it('uses proxy agent when host does not match noProxy', () => {
    const parsedUrl = new URL(
      'https://other.example-host.com/session/v1/login-request?requestId=abc',
    );
    const agent = getProxyAgent({
      proxyOptions: proxyWithNoProxy,
      parsedUrl,
      destination: parsedUrl.href,
      connectionConfig,
    });
    assert.ok(
      agent instanceof HttpsProxyAgent,
      'Expected to use a proxy agent for a non-bypassed host',
    );
  });
});
