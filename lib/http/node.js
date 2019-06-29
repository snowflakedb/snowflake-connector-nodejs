/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

var Url = require('url');
var request = require('request');
var Util = require('../util');
var Base = require('./base');
var HttpsAgent = require('../agent/https_ocsp_agent');
var HttpsProxyAgent = require('../agent/https_proxy_ocsp_agent');

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
  return request;
};

/**
 * @inheritDoc
 */
NodeHttpClient.prototype.getAgentAndProxyOptions = function (url, proxy, mock)
{
  const isHttps = Url.parse(url).protocol === 'https:';
  var agentClass;
  var agentOptions;
  var options;

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
      agentOptions =
        {
          host: proxy.host,
          port: proxy.port
        };
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
          }
      };
  }
  // otherwise, just use the default agent used by request.js

  return options || {};
};

module.exports = NodeHttpClient;