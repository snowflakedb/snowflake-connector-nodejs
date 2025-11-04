const ProxyAgent = require('./../../lib/agent/https_proxy_agent');

const assert = require('assert');

describe('SocketUtil Test - simulating ProxyAgent creation', () => {
  const HttpProxyUtilFromEnvProxy = {
    host: 'localhost',
    port: 8080,
    protocol: 'http:',
    noProxy: undefined,
    useForOCSP: true,
  };
  const HttpsProxyUtilFromEnvProxy = {
    host: 'localhost',
    port: 8080,
    protocol: 'https:',
    noProxy: undefined,
    useForOCSP: true,
  };

  [
    {
      name: 'create agent with HTTP_PROXY',
      agent: new ProxyAgent(HttpProxyUtilFromEnvProxy),
      shouldMatch: HttpProxyUtilFromEnvProxy,
    },
    {
      name: 'create agent with HTTPS_PROXY',
      agent: new ProxyAgent(HttpsProxyUtilFromEnvProxy),
      shouldMatch: HttpsProxyUtilFromEnvProxy,
    },
  ].forEach(({ name, agent, shouldMatch }) => {
    let agentWithoutClosingSlash;
    agentWithoutClosingSlash = agent.proxy.href.slice(0, -1);
    it(`${name}`, () => {
      assert.deepEqual(
        agentWithoutClosingSlash,
        shouldMatch,
        `proxy string from within ProxyAgent was ${agentWithoutClosingSlash}, expected ${shouldMatch}`,
      );
    });
  });
});
