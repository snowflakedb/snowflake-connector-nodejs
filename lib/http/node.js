/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const Util = require('../util');
const Base = require('./base');
const HttpsAgent = require('../agent/https_ocsp_agent');
const HttpsProxyAgent = require('../agent/https_proxy_agent');
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
  Base.apply(this, [connectionConfig]);
}

Util.inherits(NodeHttpClient, Base);

const httpsAgentCache = new Map();

function getFromCacheOrCreate(agentClass, options, agentId) {
  let agent = {};
  function createAgent(agentClass, agentOptions, agentId) {
    const agent = agentClass(agentOptions);
    httpsAgentCache.set(agentId, agent);
    Logger.getInstance().trace(`Create and add to cache new agent ${agentId}`);

    // detect and log PROXY envvar + agent proxy settings
    const compareAndLogEnvAndAgentProxies = Util.getCompareAndLogEnvAndAgentProxies(agentOptions);
    Logger.getInstance().debug(`Proxy settings used in requests:${compareAndLogEnvAndAgentProxies.messages}`);
    // if there's anything to warn on (e.g. both envvar + agent proxy used, and they are different)
    // log warnings on them
    if (compareAndLogEnvAndAgentProxies.warnings) {
      Logger.getInstance().warn(`${compareAndLogEnvAndAgentProxies.warnings}`);
    }

    return agent;
  }

  if (httpsAgentCache.has(agentId)) {
    Logger.getInstance().trace(`Get agent with id: ${agentId} from cache`);
    agent = httpsAgentCache.get(agentId);
  } else {
    agent = createAgent(agentClass, options, agentId);
  }
  return agent;
}

function enrichAgentOptionsWithProxyConfig(agentOptions, proxy) {
  agentOptions.host = proxy.host;
  agentOptions.port = proxy.port;
  agentOptions.protocol = proxy.protocol;
  if (proxy.user && proxy.password) {
    agentOptions.user = proxy.user;
    agentOptions.password = proxy.password;
  }
}

function isBypassProxy(proxy, destination) {
  if (proxy && proxy.noProxy) {
    const bypassList = proxy.noProxy.split('|');
    for (let i = 0; i < bypassList.length; i++) {
      let host = bypassList[i].trim();
      host = host.replace('*', '.*?');
      const matches = destination.match(host);
      if (matches) {
        Logger.getInstance().debug('bypassing proxy for %s', destination);
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
  if (!proxy && GlobalConfig.isEnvProxyActive()) {
    const isHttps = parsedUrl.protocol === 'https:';
    proxy = Util.getProxyFromEnv(isHttps);
    if (proxy) {
      Logger.getInstance().debug(`Load the proxy info from the environment variable host: ${proxy.host} in getAgent`);
    }
  }
  return getProxyAgent(proxy, parsedUrl, parsedUrl.href, mock);
};

function getProxyAgent(proxyOptions, parsedUrl, destination, mock) {
  const agentOptions = {
    protocol: parsedUrl.protocol,
    hostname: parsedUrl.hostname,
    keepAlive: GlobalConfig.getKeepAlive()
  };

  if (mock) {
    const mockAgent = mock.agentClass(agentOptions);
    if (mockAgent.protocol === parsedUrl.protocol) {
      return mockAgent;
    }
  }

  const destHost = Util.getHostFromURL(destination);
  Logger.getInstance().debug(`The destination host is: ${destHost}`);

  const agentId = createAgentId(agentOptions.protocol, agentOptions.hostname, destHost, agentOptions.keepAlive);
  const bypassProxy = isBypassProxy(proxyOptions, destination);
  let agent;
  const isHttps = agentOptions.protocol === 'https:';

  if (isHttps) {
    if (proxyOptions && !bypassProxy) {
      enrichAgentOptionsWithProxyConfig(agentOptions, proxyOptions);
      agent = getFromCacheOrCreate(HttpsProxyAgent, agentOptions, agentId);
    } else {
      agent = getFromCacheOrCreate(HttpsAgent, agentOptions, agentId);
    }
  } else if (proxyOptions && !bypassProxy) {
    enrichAgentOptionsWithProxyConfig(agentOptions, proxyOptions);
    agent = getFromCacheOrCreate(HttpAgent, agentOptions, agentId);
  } else {
    agent = getFromCacheOrCreate(HttpAgent, agentOptions, agentId);
  }
  return agent;
}

function createAgentId(protocol, hostname, destination, keepAlive) {
  return `${protocol}//${hostname}-${destination}-${keepAlive ? 'keepAlive' : 'noKeepAlive'}`;
}

//This is for the testing purpose.
function getAgentCacheSize() {
  return httpsAgentCache.size;
}

module.exports = { NodeHttpClient, getProxyAgent, getAgentCacheSize };