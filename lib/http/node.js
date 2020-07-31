/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

const Url = require('url');
const Util = require('../util');
const Base = require('./base');
const HttpsAgent = require('../agent/https_ocsp_agent');
const HttpsProxyAgent = require('../agent/https_proxy_ocsp_agent');
const HttpAgent = require('http').Agent;

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
function constructExponentialBackoffStrategy(base, cap, startsleep) {
  let sleep = startsleep;
  return () => {
    sleep = Util.nextSleepTime(base, cap, sleep);
    return sleep * 1000;
  };
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

/**
 * @inheritDoc
 */
NodeHttpClient.prototype.getRequestModule = function ()
{
  var sleep = this._connectionConfig.getRetrySfStartingSleepTime();
  var cap = this._connectionConfig.getRetrySfMaxSleepTime();
  var base = 1;
  var request = require('requestretry').defaults({delayStrategy: constructExponentialBackoffStrategy(base, cap, sleep) });
  return request;
};

/**
 * @inheritDoc
 */
NodeHttpClient.prototype.getAgentAndProxyOptions = function (url, proxy, mock)
{
  const isHttps = Url.parse(url).protocol === 'https:';
  let agentClass;
  let agentOptions = { keepAlive: false };
  let options;

  if (isHttps && mock)
  {
    agentClass = mock.agentClass;
    options = {
      agentClass: agentClass,
      agentOptions: agentOptions
    };
  }
  else if (isHttps)
  {
    if (proxy)
    {
      agentClass = HttpsProxyAgent;
      agentOptions.host = proxy.host;
      agentOptions.port = proxy.port;
    }
    else
    {
      agentClass = HttpsAgent;
    }

    options =
      {
        agentClass: agentClass,
        agentOptions: agentOptions
      };
  }
  else if (proxy)
  {
    options =
      {
        proxy:
          {
            protocol: 'http:',
            hostname: proxy.host,
            port: proxy.port
          },
        agentClass: HttpAgent,
        agentOptions: agentOptions
      };
  }
  else
  {
    options =
      {
        agentClass: HttpAgent,
        agentOptions: agentOptions
      };
  }
  // otherwise, just use the default agent used by request.js

  return options || {};
};

module.exports = NodeHttpClient;
