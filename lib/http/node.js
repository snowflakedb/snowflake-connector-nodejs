/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

const Url = require('url');
const Util = require('../util');
const Base = require('./base');
const HttpsAgent = require('../agent/https_ocsp_agent');
const HttpsProxyAgent = require('../agent/https_proxy_ocsp_agent');
const HttpAgent = require('http').Agent;
const GlobalConfig = require('../../lib/global_config');
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
  var sleep = this._connectionConfig.getRetrySfStartingSleepTime();
  var cap = this._connectionConfig.getRetrySfMaxSleepTime();
  var base = 1;
  sleep = Util.nextSleepTime(base, cap, sleep);
  return sleep * 1000;
}

/**
 * Creates a client that can be used to make requests in Node.js.
 *
 * @param {ConnectionConfig} connectionConfig
 * @constructor
 */
function NodeHttpClient(connectionConfig)
{
  Base.apply(this, arguments);
}

Util.inherits(NodeHttpClient, Base);

const httpsAgentCache = new Map();

function getFromCacheOrCreate(agentClass, options, url) {
  const parsed = Url.parse(url);
  const protocol = parsed.protocol || 'http:';
  const port = parsed.port || (protocol === 'http:' ? '80' : '443');
  const agentId = `${protocol}//${parsed.hostname}:${port}/${options.keepAlive}`
  if (httpsAgentCache.has(agentId)) {
    Logger.getInstance().trace(`Get agent with id: ${agentId} from cache`);
    return httpsAgentCache.get(agentId);
  } else {
    agent = agentClass(options)
    httpsAgentCache.set(agentId, agent);
    Logger.getInstance().trace(`Create and add to cache new agent ${agentId}`);
    return agent;
  }
}

function prepareProxyAgentOptions(agentOptions, proxy) {
  Logger.getInstance().info(`Use proxy: ${JSON.stringify(proxy)}`);
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
    let bypassList = proxy.noProxy.split("|");
    for (let i = 0; i < bypassList.length; i++) {
      host = bypassList[i].trim();
      host = host.replace("*", ".*?");
      let matches = url.match(host);
      if (matches) {
        Logger.getInstance().debug("bypassing proxy for %s", url);
        return true;
      }
    }
  }
  return false;
}

/**
 * @inheritDoc
 */
NodeHttpClient.prototype.getAgent = function (url, proxy, mock, defaultAgentOptions) {
  const isHttps = Url.parse(url).protocol === 'https:';
  let agentOptions = {keepAlive: GlobalConfig.keepAlive()};
  var bypassProxy = isBypassProxy(proxy, url);

  if (mock) {
    return mock.agentClass(agentOptions)
  }

  if (isHttps) {
    if (proxy && !bypassProxy) {
      const proxyAgentOptions = prepareProxyAgentOptions(agentOptions, proxy)
      return getFromCacheOrCreate(HttpsProxyAgent, proxyAgentOptions, url);
    } else {
      return getFromCacheOrCreate(HttpsAgent, agentOptions, url);
    }
  } else if (proxy && !bypassProxy) {
    const proxyAgentOptions = prepareProxyAgentOptions(agentOptions, proxy);
    return getFromCacheOrCreate(HttpAgent, proxyAgentOptions, url);
  } else {
    return getFromCacheOrCreate(HttpAgent, agentOptions, url);
  }
};

module.exports = NodeHttpClient;
