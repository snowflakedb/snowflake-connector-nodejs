/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

var Util = require('../util');
var SocketUtil = require('./socket_util');
const { Agent } = require('urllib');
const { buildConnector } = require('undici');

function connect({ hostname, host, protocol, port, servername, localAddress, httpSocket }, callback)
{
  var socket = connector({ hostname, host, protocol, port, servername, localAddress, httpSocket }, callback);
  return SocketUtil.secureSocket(socket, host, null);
}
var connector;
var ocspAgent;
/**
 * Creates a new HttpsOcspAgent.
 *
 * @returns {HttpsOcspAgent}
 * @constructor
 */
function HttpsOcspAgent()
{
  if (!connector)
  {
    connector = buildConnector({timeout:100000});
  }

  if (!ocspAgent)
  {
    ocspAgent = new Agent({connect});
  }
  return ocspAgent;
}

module.exports = HttpsOcspAgent;
