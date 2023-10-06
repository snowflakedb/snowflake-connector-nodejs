/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

const Util = require('../util');
const Base = require('./base');
const HttpsAgent = require('../agent/https_ocsp_agent');
const HttpsProxyAgent = require('../agent/https_proxy_ocsp_agent');
const HttpAgent = require('http').Agent;
const GlobalConfig = require('../../lib/global_config');
const Logger = require('../logger');
const Url = require("url");

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

const httpsAgentCache = new Map();

function getFromCacheOrCreate(agentClass, options, parsedUrl) {
  const protocol = parsedUrl.protocol;
  const port = parsedUrl.port || (protocol === 'http:' ? '80' : '443');
  const agentId = `${protocol}//${parsedUrl.hostname}:${port}-${options.keepAlive ? 'keepAlive' : 'noKeepAlive'}`;

  let agent ={}
  function createAgent(agentClass, agentOptions) {
    const agent = agentClass(agentOptions);
    httpsAgentCache.set(agentId, agent);
    Logger.getInstance().trace(`Create and add to cache new agent ${agentId}`);
    return agent;
  }

  if (httpsAgentCache.has(agentId)) {
    Logger.getInstance().trace(`Get agent with id: ${agentId} from cache`);
    agent = httpsAgentCache.get(agentId);
  } else {
    agent = createAgent(agentClass, options);
  }
  return agent;
}

function prepareProxyAgentOptions(agentOptions, proxy) {
  agentOptions.host = proxy.host;
  agentOptions.port = proxy.port;
  agentOptions.protocol = proxy.protocol;
  if (proxy.user && proxy.password) {
    agentOptions.user = proxy.user;
    agentOptions.password = proxy.password;
  }
}

function isBypassProxy(proxy, url, bypassProxy) {
  if (proxy && proxy.noProxy) {
    const bypassList = proxy.noProxy.split('|');
    for (let i = 0; i < bypassList.length; i++) {
      host = bypassList[i].trim();
      host = host.replace('*', '.*?');
      const matches = url.match(host);
      if (matches) {
        Logger.getInstance().debug('bypassing proxy for %s', url);
        return true;
      }
    }
  }
  return false;
}

/**
 * @inheritDoc
 */
NodeHttpClient.prototype.getAgent = function (parsedUrl, proxy, mock) {
  const agentOptions = {keepAlive: GlobalConfig.getKeepAlive()};
  if (mock) {
    const mockAgent = mock.agentClass(agentOptions);
    if (mockAgent.protocol === parsedUrl.protocol) {
      return mockAgent;
    }
  }

  const bypassProxy = isBypassProxy(proxy, parsedUrl.href);
  let agent = {};
  const isHttps = parsedUrl.protocol === 'https:';

  if (isHttps) {
    if (proxy && !bypassProxy) {
      prepareProxyAgentOptions(agentOptions, proxy);
      agent = getFromCacheOrCreate(HttpsProxyAgent, agentOptions, parsedUrl);
    } else {
      agent = getFromCacheOrCreate(HttpsAgent, agentOptions, parsedUrl);
    }
  } else if (proxy && !bypassProxy) {
    prepareProxyAgentOptions(agentOptions, proxy);
    agent = getFromCacheOrCreate(HttpAgent, agentOptions, parsedUrl);
  } else {
    agent = getFromCacheOrCreate(HttpAgent, agentOptions, parsedUrl);
  }
  return agent;
};

module.exports = NodeHttpClient;
