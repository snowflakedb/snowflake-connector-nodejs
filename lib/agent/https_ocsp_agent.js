/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

var Util = require('../util');
var HttpsAgent = require('https').Agent;
var SocketUtil = require('./socket_util');

/**
 * Creates a new HttpsOcspAgent.
 *
 * @param {Object} options
 *
 * @returns {HttpsOcspAgent}
 * @constructor
 */
function HttpsOcspAgent(options)
{
  var agent = HttpsAgent.apply(this, arguments);
  agent.createConnection = function (port, host, options)
  {
    // make sure the 'options' variables references the argument that actually
    // contains the options
    // Note: look at the Node.js https agent to understand why this code is
    // written this way
    if (port !== null && typeof port === 'object')
    {
      options = port;
    }
    else if (host !== null && typeof host === 'object')
    {
      options = host;
    }
    else if (options === null || typeof options !== 'object')
    {
      options = {};
    }

    if (typeof host !== 'string')
    {
      host = options.host;
    }

    // call super
    var socket = HttpsAgent.prototype.createConnection.apply(this, arguments);

    // secure the socket and return it
    return SocketUtil.secureSocket(socket, host, null);
  };

  return agent;
}

module.exports = HttpsOcspAgent;
