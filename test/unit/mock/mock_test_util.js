/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

var Util           = require('./../../../lib/util');
var Core           = require('./../../../lib/core');
var MockHttpClient = require('./../../mock_http_client');
var ErrorCodes     = require('./../../../lib/errors').codes;
var assert         = require('assert');
var async          = require('async');

var clientInfo =
{
  version     : require('./../../../package.json').version,
  environment : process.versions
};

// create a snowflake instance that operates in qa mode and is configured to
// use a mock http client
var snowflake = Core(
{
  qaMode      : true,
  httpClient  : new MockHttpClient(clientInfo),
  loggerClass : require('./../../../lib/logger/node'),
  client      : clientInfo
});

exports.snowflake = snowflake;

var connectionOptions =
{
  accessUrl : 'http://fakeaccount.snowflakecomputing.com',
  username  : 'fakeusername',
  password  : 'fakepassword',
  account   : 'fakeaccount'
};

var connectionOptionsDeserialize =
{
  accessUrl : 'http://fakeaccount.snowflakecomputing.com'
};

exports.connectionOptions =
{
  default: connectionOptions,
  deserialize: connectionOptionsDeserialize
};