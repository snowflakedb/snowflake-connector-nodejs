/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

var Core = require('./../../../lib/core');
var MockHttpClient = require('./mock_http_client');

var clientInfo =
  {
    version: require('./../../../package.json').version,
    environment: process.versions
  };

// create a snowflake instance that operates in qa mode and is configured to
// use a mock http client
var snowflake = Core(
  {
    qaMode: true,
    httpClient: new MockHttpClient(clientInfo),
    loggerClass: require('./../../../lib/logger/node'),
    client: clientInfo
  });

exports.snowflake = snowflake;

var connectionOptions =
  {
    accessUrl: 'http://fakeaccount.snowflakecomputing.com',
    username: 'fakeusername',
    password: 'fakepassword',
    account: 'fakeaccount'
  };

var connectionOptionsDeserialize =
  {
    accessUrl: 'http://fakeaccount.snowflakecomputing.com'
  };

var connectionOptionsWithServiceName =
  {
    accessUrl: 'http://fakeaccount.snowflakecomputing.com',
    username: 'fakeuserservicename',
    password: 'fakepassword',
    account: 'fakeaccount'
  };

var connectionOptionsWithClientSessionKeepAlive =
  {
    accessUrl: 'http://fakeaccount.snowflakecomputing.com',
    username: 'fakeusername',
    password: 'fakepassword',
    account: 'fakeaccount',
    clientSessionKeepAlive: true,
    clientSessionKeepAliveHeartbeatFrequency: 1800
  };

var connectionOptionsForSessionGone =
  {
    accessUrl: 'http://fakeaccount.snowflakecomputing.com',
    username: 'fakesessiongone',
    password: 'fakepassword',
    account: 'fakeaccount'
  };

var connectionOptions504 =
  {
    accessUrl: 'http://fake504.snowflakecomputing.com',
    username: 'fake504user',
    password: 'fakepassword',
    account: 'fake504'
  };

var connectionOptionsWithTreatIntAsBigInt =
  {
    accessUrl: 'http://fakeaccount.snowflakecomputing.com',
    username: 'fakeusername',
    password: 'fakepassword',
    account: 'fakeaccount',
    jsTreatIntegerAsBigInt: true
  };

var connectionOptionsDefault =
{
  accessUrl: 'http://fakeaccount.snowflakecomputing.com',
  username: 'fakeusername',
  password: 'fakepassword',
  account: 'fakeaccount',
  authenticator: 'SNOWFLAKE'
};

var connectionOptionsExternalBrowser =
{
  accessUrl: 'http://fakeaccount.snowflakecomputing.com',
  username: 'fakeusername',
  account: 'fakeaccount',
  authenticator: 'EXTERNALBROWSER'
};

exports.connectionOptions =
  {
    default: connectionOptions,
    deserialize: connectionOptionsDeserialize,
    serviceName: connectionOptionsWithServiceName,
    clientSessionKeepAlive: connectionOptionsWithClientSessionKeepAlive,
    sessionGone: connectionOptionsForSessionGone,
    http504: connectionOptions504,
    treatIntAsBigInt: connectionOptionsWithTreatIntAsBigInt,
    authenticatorDefault: connectionOptionsDefault,
    authenticatorExternalBrowser: connectionOptionsExternalBrowser
  };
