const ProxyUtil = require('./../../lib/proxy_util');
const Util = require('./../../lib/util');
const GlobalConfig = require('../../lib/global_config');

const assert = require('assert');

describe('ProxyUtil Test - removing http or https from string', () => {
  const hostAndPortDone = 'my.pro.xy:8080';
  const ipAndPortDone = '10.20.30.40:8080';
  const somethingEntirelyDifferentDone = 'something ENTIRELY different';

  [
    { name: 'remove http from url', text: 'http://my.pro.xy:8080', shouldMatch: hostAndPortDone },
    { name: 'remove https from url', text: 'https://my.pro.xy:8080', shouldMatch: hostAndPortDone },
    { name: 'remove http from ip and port', text: 'http://10.20.30.40:8080', shouldMatch: ipAndPortDone },
    { name: 'remove https from ip and port', text: 'https://10.20.30.40:8080', shouldMatch: ipAndPortDone },
    { name: 'dont remove http(s) from hostname and port', text: 'my.pro.xy:8080', shouldMatch: hostAndPortDone },
    { name: 'dont remove http(s) from ip and port', text: '10.20.30.40:8080', shouldMatch: ipAndPortDone },
    { name: 'dont remove http(s) from simple string', text: somethingEntirelyDifferentDone, shouldMatch: somethingEntirelyDifferentDone }
  ].forEach(({ name, text, shouldMatch }) => {
    it(`${name}`, () => {
      assert.deepEqual(ProxyUtil.removeScheme(text), shouldMatch);
    });
  });
});

describe('ProxyUtil Test - detecting PROXY envvars and compare with the agent proxy settings', () => {
  let originalHttpProxy = null;
  let originalHttpsProxy = null;

  before(() => {
    originalHttpProxy = process.env.HTTP_PROXY;
    originalHttpsProxy = process.env.HTTPS_PROXY;
  });

  after(() => {
    originalHttpProxy ? process.env.HTTP_PROXY = originalHttpProxy : delete process.env.HTTP_PROXY;
    originalHttpsProxy ? process.env.HTTPS_PROXY = originalHttpsProxy : delete process.env.HTTPS_PROXY;
  });

  [
    {
      name: 'detect http_proxy envvar, no agent proxy',
      isWarn: false,
      httpproxy: '10.20.30.40:8080',
      HTTPSPROXY: '',
      agentOptions: { 'keepalive': true },
      shouldLog: ' // PROXY environment variables: HTTP_PROXY: 10.20.30.40:8080 HTTPS_PROXY: <unset> NO_PROXY: <unset>.'
    }, {
      name: 'detect HTTPS_PROXY envvar, no agent proxy',
      isWarn: false,
      httpproxy: '',
      HTTPSPROXY: 'http://pro.xy:3128',
      agentOptions: { 'keepalive': true },
      shouldLog: ' // PROXY environment variables: HTTP_PROXY: <unset> HTTPS_PROXY: http://pro.xy:3128 NO_PROXY: <unset>.'
    }, {
      name: 'detect both http_proxy and HTTPS_PROXY envvar, no agent proxy',
      isWarn: false,
      httpproxy: '10.20.30.40:8080',
      HTTPSPROXY: 'http://pro.xy:3128',
      agentOptions: { 'keepalive': true },
      shouldLog: ' // PROXY environment variables: HTTP_PROXY: 10.20.30.40:8080 HTTPS_PROXY: http://pro.xy:3128 NO_PROXY: <unset>.'
    }, {
      name: 'detect http_proxy envvar, agent proxy set to an unauthenticated proxy, same as the envvar',
      isWarn: false,
      httpproxy: '10.20.30.40:8080',
      HTTPSPROXY: '',
      agentOptions: { 'keepalive': true, 'host': '10.20.30.40', 'port': 8080 },
      shouldLog: ' // PROXY environment variables: HTTP_PROXY: 10.20.30.40:8080 HTTPS_PROXY: <unset> NO_PROXY: <unset>. // Proxy configured in Agent: proxy=10.20.30.40:8080'
    }, {
      name: 'detect both http_proxy and HTTPS_PROXY envvar, agent proxy set to an unauthenticated proxy, same as the envvar',
      isWarn: false,
      httpproxy: '10.20.30.40:8080',
      HTTPSPROXY: 'http://10.20.30.40:8080',
      agentOptions: { 'keepalive': true, 'host': '10.20.30.40', 'port': 8080 },
      shouldLog: ' // PROXY environment variables: HTTP_PROXY: 10.20.30.40:8080 HTTPS_PROXY: http://10.20.30.40:8080 NO_PROXY: <unset>. // Proxy configured in Agent: proxy=10.20.30.40:8080'
    }, {
      name: 'detect both http_proxy and HTTPS_PROXY envvar, agent proxy set to an authenticated proxy, same as the envvar',
      isWarn: false,
      httpproxy: '10.20.30.40:8080',
      HTTPSPROXY: 'http://10.20.30.40:8080',
      agentOptions: { 'keepalive': true, 'host': '10.20.30.40', 'port': 8080, 'user': 'PRX', 'password': 'proxypass' },
      shouldLog: ' // PROXY environment variables: HTTP_PROXY: 10.20.30.40:8080 HTTPS_PROXY: http://10.20.30.40:8080 NO_PROXY: <unset>. // Proxy configured in Agent: proxy=10.20.30.40:8080 user=PRX'
    }, {
      name: 'detect both http_proxy and HTTPS_PROXY envvar, agent proxy set to an authenticated proxy, same as the envvar, with the protocol set',
      isWarn: false,
      httpproxy: '10.20.30.40:8080',
      HTTPSPROXY: 'http://10.20.30.40:8080',
      agentOptions: { 'keepalive': true, 'host': '10.20.30.40', 'port': 8080, 'user': 'PRX', 'password': 'proxypass', 'protocol': 'http' },
      shouldLog: ' // PROXY environment variables: HTTP_PROXY: 10.20.30.40:8080 HTTPS_PROXY: http://10.20.30.40:8080 NO_PROXY: <unset>. // Proxy configured in Agent: protocol=http proxy=10.20.30.40:8080 user=PRX'
    }, {
      // now some WARN level messages
      name: 'detect HTTPS_PROXY envvar, agent proxy set to an unauthenticated proxy, different from the envvar',
      isWarn: true,
      httpproxy: '',
      HTTPSPROXY: 'http://pro.xy:3128',
      agentOptions: { 'keepalive': true, 'host': '10.20.30.40', 'port': 8080 },
      shouldLog: ' Using both the HTTPS_PROXY (proxyHost: pro.xy, proxyPort: 3128, proxyProtocol: http:, noProxy: undefined) and the Connection proxy (proxyHost: 10.20.30.40, proxyPort: 8080, proxyProtocol: undefined, noProxy: undefined) settings to connect, but with different values. If you experience connectivity issues, try unsetting one of them.'
    }, {
      name: 'detect both http_proxy and HTTPS_PROXY envvar, different from each other, agent proxy set to an unauthenticated proxy, different from the envvars',
      isWarn: true,
      httpproxy: '169.254.169.254:8080',
      HTTPSPROXY: 'http://pro.xy:3128',
      agentOptions: { 'keepalive': true, 'host': '10.20.30.40', 'port': 8080 },
      shouldLog: ' Using both the HTTP_PROXY (proxyHost: 169.254.169.254, proxyPort: 8080, proxyProtocol: http:, noProxy: undefined) and the Connection proxy (proxyHost: 10.20.30.40, proxyPort: 8080, proxyProtocol: undefined, noProxy: undefined), but with different values. If you experience connectivity issues, try unsetting one of them. Using both the HTTPS_PROXY (proxyHost: pro.xy, proxyPort: 3128, proxyProtocol: http:, noProxy: undefined) and the Connection proxy (proxyHost: 10.20.30.40, proxyPort: 8080, proxyProtocol: undefined, noProxy: undefined) settings to connect, but with different values. If you experience connectivity issues, try unsetting one of them.'
    },
    {
      name: 'detect both http_proxy and HTTPS_PROXY envvar, different from each other, agent proxy set to an authenticated proxy, different from the envvars',
      isWarn: true,
      httpproxy: 'abc:def@169.254.169.254:8080',
      HTTPSPROXY: 'http://cde:fge@pro.xy:3128',
      agentOptions: { 'keepalive': true, 'host': '10.20.30.40', 'user': 'cde', 'password': 'fge', 'port': 8080 },
      shouldLog: ' Using both the HTTP_PROXY (proxyHost: 169.254.169.254, proxyPort: 8080, proxyUser: abc, proxyPassword is provided, proxyProtocol: http:, noProxy: undefined) and the Connection proxy (proxyHost: 10.20.30.40, proxyPort: 8080, proxyUser: cde, proxyPassword is provided, proxyProtocol: undefined, noProxy: undefined), but with different values. If you experience connectivity issues, try unsetting one of them. Using both the HTTPS_PROXY (proxyHost: pro.xy, proxyPort: 3128, proxyUser: cde, proxyPassword is provided, proxyProtocol: http:, noProxy: undefined) and the Connection proxy (proxyHost: 10.20.30.40, proxyPort: 8080, proxyUser: cde, proxyPassword is provided, proxyProtocol: undefined, noProxy: undefined) settings to connect, but with different values. If you experience connectivity issues, try unsetting one of them.'
    }
  ].forEach(({ name, isWarn, httpproxy, HTTPSPROXY, agentOptions, shouldLog }) => {
    it(`${name}`, () => {
      process.env.HTTP_PROXY = httpproxy;
      process.env.HTTPS_PROXY = HTTPSPROXY;

      const compareAndLogEnvAndAgentProxies = ProxyUtil.getCompareAndLogEnvAndAgentProxies(agentOptions);
      if (!isWarn) {
        assert.deepEqual(compareAndLogEnvAndAgentProxies.messages, shouldLog, 'expected log message does not match!');
      } else {
        assert.deepEqual(compareAndLogEnvAndAgentProxies.warnings, shouldLog, 'expected warning message does not match!');
      }
    });
  });
});

describe('getProxyEnv function test ', function () {
  let originalHttpProxy = null;
  let originalHttpsProxy = null;
  let originalNoProxy = null;

  before(() => {
    originalHttpProxy = process.env.HTTP_PROXY;
    originalHttpsProxy = process.env.HTTPS_PROXY;
    originalNoProxy = process.env.NO_PROXY; 
  });

  beforeEach(() => {
    delete process.env.HTTP_PROXY;
    delete process.env.HTTPS_PROXY;
    delete process.env.NO_PROXY;
  });

  after(() => {
    originalHttpProxy ? process.env.HTTP_PROXY = originalHttpProxy : delete process.env.HTTP_PROXY;
    originalHttpsProxy ? process.env.HTTPS_PROXY = originalHttpsProxy : delete process.env.HTTPS_PROXY;
    originalNoProxy ? process.env.NO_PROXY = originalNoProxy : delete process.env.NO_PROXY; 
  });

  const testCases = [
    {
      name: 'HTTP PROXY without authentication and schema',
      isHttps: false,
      httpProxy: 'proxy.example.com:8080',
      httpsProxy: undefined,
      noProxy: '*.amazonaws.com',
      result: {
        host: 'proxy.example.com',
        port: 8080,
        protocol: 'http:',
        noProxy: '*.amazonaws.com'
      }
    },
    {
      name: 'HTTP PROXY with authentication',
      isHttps: false,
      httpProxy: 'http://hello:world@proxy.example.com:8080', //# pragma: allowlist secret
      httpsProxy: undefined,
      noProxy: '*.amazonaws.com,*.my_company.com',
      result: {
        host: 'proxy.example.com',
        user: 'hello',
        password: 'world',
        port: 8080,
        protocol: 'http:',
        noProxy: '*.amazonaws.com|*.my_company.com'
      }
    },
    {
      name: 'HTTPS PROXY with authentication without NO proxy',
      isHttps: true,
      httpsProxy: 'https://user:pass@myproxy.server.com:1234', //# pragma: allowlist secret
      result: {
        host: 'myproxy.server.com',
        user: 'user',
        password: 'pass',
        port: 1234,
        protocol: 'https:',
        noProxy: undefined,
      },
    },
    {
      name: 'HTTPS PROXY with authentication without NO proxy No schema',
      isHttps: true,
      noProxy: '*.amazonaws.com,*.my_company.com,*.test.com',
      httpsProxy: 'myproxy.server.com:1234',
      result: {
        host: 'myproxy.server.com',
        port: 1234,
        protocol: 'http:',
        noProxy: '*.amazonaws.com|*.my_company.com|*.test.com',
      },
    },
    {
      name: 'HTTPS PROXY with authentication without port and protocol',
      isHttps: true,
      noProxy: '*.amazonaws.com,*.my_company.com,*.test.com',
      httpsProxy: 'myproxy.server.com',
      result: {
        host: 'myproxy.server.com',
        port: 80,
        protocol: 'http:',
        noProxy: '*.amazonaws.com|*.my_company.com|*.test.com',
      },
    },
    {
      name: 'HTTP PROXY with authentication without port and protocol',
      isHttps: false,
      noProxy: '*.amazonaws.com,*.my_company.com,*.test.com',
      httpProxy: 'myproxy.server.com',
      result: {
        host: 'myproxy.server.com',
        port: 80,
        protocol: 'http:',
        noProxy: '*.amazonaws.com|*.my_company.com|*.test.com',
      },
    },
    {
      name: 'HTTPS PROXY with authentication without port',
      isHttps: true,
      noProxy: '*.amazonaws.com,*.my_company.com,*.test.com',
      httpsProxy: 'https://myproxy.server.com',
      result: {
        host: 'myproxy.server.com',
        port: 443,
        protocol: 'https:',
        noProxy: '*.amazonaws.com|*.my_company.com|*.test.com',
      }
    }
  ];

  testCases.forEach(({ name, isHttps, httpsProxy, httpProxy, noProxy, result }) => {
    it(name, function (){

      if (httpProxy){
        process.env.HTTP_PROXY = httpProxy;
      }
      if (httpsProxy) {
        process.env.HTTPS_PROXY = httpsProxy; 
      }
      if (noProxy) {
        process.env.NO_PROXY = noProxy; 
      }
      const proxy =  ProxyUtil.getProxyFromEnv(isHttps);
      const keys = Object.keys(result);
      assert.strictEqual(keys.length, Object.keys(proxy).length);

      for (const key of keys) {
        assert.strictEqual(proxy[key], result[key]);
      }
    });
  });
});

describe('getNoProxyEnv function Test', function () {
  let original = null;

  before( function (){
    original = process.env.NO_PROXY; 
    process.env.NO_PROXY = '*.amazonaws.com,*.my_company.com';
  });

  after(() => {
    process.env.NO_PROXY = original;
  });

  it('test noProxy conversion', function (){
    assert.strictEqual(ProxyUtil.getNoProxyEnv(), '*.amazonaws.com|*.my_company.com');
  });
});

describe('Proxy Util for Azure', function () {
  let originalhttpProxy = null;
  let originalhttpsProxy = null;
  let originalnoProxy = null;
  let originalHttpProxy = null;
  let originalHttpsProxy = null;
  let originalNoProxy = null;

  before(() => {
    GlobalConfig.setEnvProxy(false);
    originalHttpProxy = process.env.HTTP_PROXY;
    originalHttpsProxy = process.env.HTTPS_PROXY;
    originalNoProxy = process.env.NO_PROXY; 
    if (!Util.isWindows()) {
      originalhttpProxy = process.env.http_proxy;
      originalhttpsProxy = process.env.https_proxy;
      originalnoProxy = process.env.no_proxy; 
    }
  });

  after(() => {
    GlobalConfig.setEnvProxy(true);
    originalHttpProxy ? process.env.HTTP_PROXY = originalHttpProxy : delete process.env.HTTP_PROXY;
    originalHttpsProxy ? process.env.HTTPS_PROXY = originalHttpsProxy : delete process.env.HTTPS_PROXY;
    originalNoProxy ? process.env.NO_PROXY = originalNoProxy : delete process.env.NO_PROXY; 
    if (!Util.isWindows()) {
      originalhttpProxy ? process.env['http_proxy'] = originalhttpProxy : delete process.env.http_proxy;
      originalhttpsProxy ? process.env['https_proxy'] = originalhttpsProxy : delete process.env.https_proxy;
      originalnoProxy ? process.env['no_proxy'] = originalnoProxy : delete process.env.no_proxy; 
    }
  });

  
  it('test hide and restore environment proxy', function () {
    const testCases = 
    {
      httpProxy: 'https://user:pass@myproxy.server.com:1234', //# pragma: allowlist secret
      httpsProxy: 'https://user:pass@myproxy.server.com:1234', //# pragma: allowlist secret
      noProxy: '*.amazonaws.com,*.my_company.com',
      HttpProxy: 'https://user:pass@myproxy2.server.com:1234', //# pragma: allowlist secret
      HttpsProxy: 'https://user:pass@myproxy2.server.com:1234', //# pragma: allowlist secret
      NoProxy: '*.amazonaws2.com,*.my_company2.com',
    };

    process.env.HTTP_PROXY = testCases.HttpProxy;
    process.env.HTTPS_PROXY = testCases.HttpsProxy;
    process.env.NO_PROXY = testCases.NoProxy; 
    if (!Util.isWindows()) {
      process.env['http_proxy'] = testCases.httpProxy;
      process.env['https_proxy'] = testCases.httpsProxy;
      process.env['no_proxy'] = testCases.noProxy;
    }
    
    ProxyUtil.hideEnvironmentProxy();
    assert.strictEqual(process.env.HTTP_PROXY, undefined);
    assert.strictEqual(process.env.HTTPS_PROXY, undefined);
    assert.strictEqual(process.env.NO_PROXY, undefined); 
    if (!Util.isWindows()) {
      assert.strictEqual(process.env['http_proxy'], undefined);
      assert.strictEqual(process.env['https_proxy'], undefined);
      assert.strictEqual(process.env['no_proxy'], undefined);
    }

    ProxyUtil.restoreEnvironmentProxy();
    assert.strictEqual(process.env.HTTP_PROXY, testCases.HttpProxy);
    assert.strictEqual(process.env.HTTPS_PROXY, testCases.HttpsProxy);
    assert.strictEqual(process.env.NO_PROXY, testCases.NoProxy); 
    if (!Util.isWindows()) {
      assert.strictEqual(process.env.http_proxy, testCases.httpProxy);
      assert.strictEqual(process.env.https_proxy, testCases.httpsProxy);
      assert.strictEqual(process.env.no_proxy, testCases.noProxy);
    }
  });
});