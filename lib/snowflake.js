/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

var core = require('./core');
var Util = require('./util');
var Errors = require('./errors');
var ErrorCodes = Errors.codes;

var clientEnvironment = process.versions;

// if we're not using the minimum supported version of node.js, raise an error
var minimumNodeVersion = '6.0.0';
if (Util.string.compareVersions(clientEnvironment.node, minimumNodeVersion) < 0)
{
  throw Errors.createClientError(
    ErrorCodes.ERR_UNSUPPORTED_NODE_JS_VERSION, true, minimumNodeVersion);
}

module.exports = core(
  {
    httpClientClass: require('./http/node'),
    loggerClass: require('./logger/node'),
    client:
      {
        version: Util.driverVersion,
        environment: clientEnvironment
      }
  });