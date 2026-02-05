import assert from 'assert';
import { describe, it } from 'vitest';
import { WIP_ConnectionConfig } from '../../lib/connection/types';
import { createRequire } from 'module';

describe('getProxyAgent', function () {
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

  it('test http(s) agent cache', async () => {
    // Use createRequire to get access to CommonJS require
    const require = createRequire(import.meta.url);

    // Clear require cache for the modules we need to reload
    const globalConfigPath = require.resolve('../../lib/global_config');
    const nodeUntypedPath = require.resolve('../../lib/http/node_untyped');
    const nodePath = require.resolve('../../lib/http/node');

    // Delete from cache to force reload
    delete require.cache[globalConfigPath];
    delete require.cache[nodeUntypedPath];
    delete require.cache[nodePath];

    // Now require fresh modules
    const GlobalConfig = require('../../lib/global_config');
    const { getProxyAgent, httpsAgentCache } = require('../../lib/http/node');

    httpsAgentCache.clear();
    assert.strictEqual(httpsAgentCache.size, 0, 'Cache should be empty at start');

    let numofAgent = 0;
    for (let index = 0; index < testCases.length; index++) {
      const { destination, isNewAgent, keepAlive, crlCheckMode } = testCases[index];
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
      assert.strictEqual(
        httpsAgentCache.size,
        numofAgent,
        `Case ${index + 1}: destination=${destination}, keepAlive=${keepAlive}, isNewAgent=${isNewAgent}, expected=${numofAgent}`,
      );
    }

    // Cleanup: restore keepAlive to default
    GlobalConfig.setKeepAlive(true);
  });
});
