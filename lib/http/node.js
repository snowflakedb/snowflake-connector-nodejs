/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

const Url = require('url');
const Util = require('../util');
const Base = require('./base');
const { HttpsOcspAgent, ProxyHttpsOcspAgent } = require('../agent/https_ocsp_agent');
const OldStyleHttpsProxyAgent = require('../agent/https_proxy_ocsp_agent');
const urllib = require('urllib');
const HttpAgent = urllib.Agent;
const ProxyAgent = urllib.ProxyAgent;
const Logger = require('../logger');

/**
 * Returns the delay time calculated by exponential backoff with
 * decorrelated jitter.
 * for more details, check out:
 * http://www.awsarchitectureblog.com/2015/03/backoff.html
 * @param base minimum seconds
 * @param cap maximum seconds
 * @param previousSleep previous sleep time
 * @return  {Number} number of milliseconds to wait before retrying again the request.
 */
NodeHttpClient.prototype.constructExponentialBackoffStrategy = function () {
  let sleep = this._connectionConfig.getRetrySfStartingSleepTime();
  const cap = this._connectionConfig.getRetrySfMaxSleepTime();
  const base = 1;
  sleep = Util.nextSleepTime(base, cap, sleep);
  return sleep * 1000;
};

/**
 * Creates a client that can be used to make requests in Node.js.
 *
 * @param {ConnectionConfig} connectionConfig
 * @constructor
 */
function NodeHttpClient(connectionConfig) {
  Base.apply(this, arguments);
}

Util.inherits(NodeHttpClient, Base);

function createProxyAgentOptions(proxy) {
  const secureProxy = proxy.protocol ? /^https:?$/i.test(proxy.protocol) : false;
  return {
    uri: `${secureProxy ? 'https' : 'http'}://${proxy.host}:${proxy.port}`,
    auth: proxy.user && proxy.password ? Buffer.from(`${proxy.user}:${proxy.password}`, 'utf8').toString('base64') : undefined,
  };
}

/**
 * @inheritDoc
 */
NodeHttpClient.prototype.getAgentAndProxyOptions = function (url, proxy, mock) {
  const isHttps = Url.parse(url).protocol === 'https:';
  let agentClass;
  const agentOptions = { keepAlive: true };
  let options;
  let bypassProxy = false;

  if (proxy && proxy.noProxy) {
    const bypassList = proxy.noProxy.split('|');
    for (let i = 0; i < bypassList.length; i++) {
      host = bypassList[i].trim();
      host = host.replace('*', '.*?');
      const matches = url.match(host);
      if (matches) {
        Logger.getInstance().debug('bypassing proxy for %s', url);
        bypassProxy = true;
      }
    }
  }

  if (isHttps && mock) {
    agentClass = mock.agentClass;
    options = {
      agentClass: agentClass,
      agentOptions: agentOptions,
    };
  } else if (isHttps) {
    if (proxy && !bypassProxy) {
      agentClass = (options) => new ProxyHttpsOcspAgent({
        ...options,
        ...createProxyAgentOptions(proxy),
        ocspResponderHttpAgent: OldStyleHttpsProxyAgent({...proxy}), // OCSP responder via proxy is still accessed via old style https proxy agent
      });
    } else {
      agentClass = (options) => new HttpsOcspAgent(options);
    }
    options =
      {
        agentClass: agentClass,
        agentOptions: agentOptions,
      };
  } else if (proxy && !bypassProxy) {
    options =
    {
      agentClass: (options) => new ProxyAgent({
        ...options,
        ...createProxyAgentOptions(proxy),
      }),
      agentOptions: agentOptions,
    };
  } else {
    options =
      {
        agentClass: (options) => new HttpAgent(options),
        agentOptions: agentOptions,
      };
  }
  return options || {};
};

module.exports = NodeHttpClient;
