const ProxyUtil = require('./../../lib/proxy_util');
const ProxyAgent = require('./../../lib/agent/https_proxy_agent');

const assert = require('assert');

describe('SocketUtil Test - simulating ProxyAgent creation', () => {
  let originalHttpProxy = null;
  let originalHttpsProxy = null;

  before(() => {
    originalHttpProxy = process.env.HTTP_PROXY;
    originalHttpsProxy = process.env.HTTPS_PROXY;
  });

  after(() => {
    originalHttpProxy
      ? (process.env.HTTP_PROXY = originalHttpProxy)
      : delete process.env.HTTP_PROXY;
    originalHttpsProxy
      ? (process.env.HTTPS_PROXY = originalHttpsProxy)
      : delete process.env.HTTPS_PROXY;
  });

  [
    {
      name: 'create agent with proxy envvar set to http proxy',
      isHttps: false,
      shouldMatch: 'http://my.http.pro.xy:8080',
    },
    {
      name: 'create agent with proxy envvar set to https proxy',
      isHttps: true,
      shouldMatch: 'https://my.https.pro.xy:8080',
    },
  ].forEach(({ name, isHttps, shouldMatch }) => {
    it(`${name}`, () => {
      process.env.HTTP_PROXY = shouldMatch;
      process.env.HTTPS_PROXY = shouldMatch;

      const proxyToUse = ProxyUtil.getProxyFromEnv(isHttps);
      const proxyProtocol = isHttps ? 'https:' : 'http:';

      const agent = new ProxyAgent(proxyToUse);
      const agentProxyUrlWithoutClosingSlash = agent.proxy.href.slice(0, -1);
      const agentProxyProtocol = agent.proxy.protocol;

      assert.deepEqual(
        agentProxyUrlWithoutClosingSlash,
        shouldMatch,
        `proxy string from within ProxyAgent was ${agentProxyUrlWithoutClosingSlash}, expected ${shouldMatch}`,
      );
      assert.deepEqual(
        agentProxyProtocol,
        proxyProtocol,
        `proxy protocol from within ProxyAgent was ${agentProxyProtocol}, expected ${proxyProtocol}`,
      );
    });
  });
});
