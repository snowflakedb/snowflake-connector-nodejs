import assert from 'assert';
import { getProxyAgent } from './../../lib/http/node';
import { WIP_ConnectionConfig } from '../../lib/connection/types';
import * as GlobalConfig from './../../lib/global_config';
import HttpsProxyAgent from './../../lib/agent/https_proxy_agent';

const ConnectionConfig = require('../../lib/connection/connection_config');

function createConnectionConfig(): WIP_ConnectionConfig {
  return new ConnectionConfig({
    username: 'username',
    password: 'password',
    account: 'account',
  });
}

describe('getProxyAgent', function () {
  const mockProxy = new URL('https://user:pass@myproxy.server.com:1234');
  const fakeAccessUrl = new URL('http://fakeaccount.snowflakecomputing.com');

  // Within a single connection, distinct destinations/keys each create a new
  // cached agent, while re-requesting the same key reuses the existing one.
  const distinctKeyCases = [
    { destination: 'https://a.destination.snowflakecomputing.com/login', keepAlive: true },
    { destination: 'https://b.destination.snowflakecomputing.com/login', keepAlive: true },
    { destination: 'https://b.destination.snowflakecomputing.com/login', keepAlive: false },
  ];

  it('reuses agents within one connection for the same key', () => {
    const connectionConfig = createConnectionConfig();
    const cache = connectionConfig.agentCache;

    let expectedSize = 0;
    distinctKeyCases.forEach(({ destination, keepAlive }) => {
      GlobalConfig.setKeepAlive(keepAlive);
      expectedSize++;
      getProxyAgent({
        proxyOptions: mockProxy,
        parsedUrl: fakeAccessUrl,
        destination,
        connectionConfig,
      });
      assert.strictEqual(cache.size, expectedSize);
      // Re-requesting the same destination/key on the same connection reuses the agent.
      getProxyAgent({
        proxyOptions: mockProxy,
        parsedUrl: fakeAccessUrl,
        destination,
        connectionConfig,
      });
      assert.strictEqual(cache.size, expectedSize);
    });
  });

  it('isolates agents across connections to the same host', () => {
    GlobalConfig.setKeepAlive(true);
    const connectionA = createConnectionConfig();
    const connectionB = createConnectionConfig();

    const destination = 'https://shared-host.snowflakecomputing.com/login';

    const agentA = getProxyAgent({
      proxyOptions: mockProxy,
      parsedUrl: fakeAccessUrl,
      destination,
      connectionConfig: connectionA,
    });
    const agentB = getProxyAgent({
      proxyOptions: mockProxy,
      parsedUrl: fakeAccessUrl,
      destination,
      connectionConfig: connectionB,
    });

    assert.notStrictEqual(agentA, agentB, 'agents must not be shared across connections');
    assert.strictEqual(connectionA.agentCache.size, 1);
    assert.strictEqual(connectionB.agentCache.size, 1);
  });

  it('destroys cached agents and empties the cache on teardown', () => {
    GlobalConfig.setKeepAlive(true);
    const connectionConfig = createConnectionConfig();
    const agent = getProxyAgent({
      proxyOptions: mockProxy,
      parsedUrl: fakeAccessUrl,
      destination: 'https://teardown-host.snowflakecomputing.com/login',
      connectionConfig,
    });

    let destroyed = false;
    const originalDestroy = agent.destroy.bind(agent);
    agent.destroy = function () {
      destroyed = true;
      return originalDestroy();
    };

    assert.strictEqual(connectionConfig.agentCache.size, 1);
    connectionConfig.destroyAgentCache();
    assert.ok(destroyed, 'agent.destroy() should be called on teardown');
    assert.strictEqual(connectionConfig.agentCache.size, 0);
  });
});

describe('getProxyAgent - noProxy bypass with full request URLs', function () {
  const proxyWithNoProxy = {
    host: 'my.pro.xy',
    port: 8080,
    protocol: 'http:',
    noProxy: '*.snowflakecomputing.com',
  };

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
      connectionConfig: createConnectionConfig(),
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
      connectionConfig: createConnectionConfig(),
    });
    assert.ok(
      agent instanceof HttpsProxyAgent,
      'Expected to use a proxy agent for a non-bypassed host',
    );
  });
});
