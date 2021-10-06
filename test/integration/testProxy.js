/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
var snowflake = require('./../../lib/snowflake');
var async = require('async');
var testUtil = require('./testUtil');

let snowflakeTestProtocol = process.env.SNOWFLAKE_TEST_PROTOCOL;
let snowflakeTestHost = process.env.SNOWFLAKE_TEST_HOST;
let snowflakeTestPort = process.env.SNOWFLAKE_TEST_PORT;
let snowflakeTestProxyHost = process.env.SNOWFLAKE_TEST_PROXY_HOST;
let snowflakeTestProxyPort = process.env.SNOWFLAKE_TEST_PROXY_PORT;
const snowflakeTestAccount = process.env.SNOWFLAKE_TEST_ACCOUNT;
const snowflakeTestUser = process.env.SNOWFLAKE_TEST_USER;
const snowflakeTestDatabase = process.env.SNOWFLAKE_TEST_DATABASE;
const snowflakeTestWarehouse = process.env.SNOWFLAKE_TEST_WAREHOUSE;
const snowflakeTestSchema = process.env.SNOWFLAKE_TEST_SCHEMA;
const snowflakeTestRole = process.env.SNOWFLAKE_TEST_ROLE;
const snowflakeTestPassword = process.env.SNOWFLAKE_TEST_PASSWORD;

if (snowflakeTestProtocol === undefined)
{
  snowflakeTestProtocol = 'https';
}

if (snowflakeTestHost === undefined)
{
  snowflakeTestHost = snowflakeTestAccount + '.snowflakecomputing.com';
}

if (snowflakeTestPort === undefined)
{
  snowflakeTestPort = '443';
}

if (snowflakeTestProxyHost === undefined)
{
  snowflakeTestProxyHost = 'localhost';
}

if (snowflakeTestProxyPort === undefined)
{
  snowflakeTestProxyPort = '3128';
}

const accessUrl = snowflakeTestProtocol + '://' + snowflakeTestHost + ':' +
  snowflakeTestPort;

const connectionWithProxy =
{
  accessUrl: accessUrl,
  username: snowflakeTestUser,
  password: snowflakeTestPassword,
  account: snowflakeTestAccount,
  warehouse: snowflakeTestWarehouse,
  database: snowflakeTestDatabase,
  schema: snowflakeTestSchema,
  role: snowflakeTestRole,
  proxyHost: snowflakeTestProxyHost,
  proxyPort: parseInt(snowflakeTestProxyPort, 10)
};

describe('testProxy', function ()
{
  it('testConnectionWithProxy', function (done)
  {
    var connection = snowflake.createConnection(connectionWithProxy);
    async.series(
      [
        function (callback)
        {
          console.log("connect start");
          testUtil.connect(connection, callback);
          console.log("connect end");
        },
        function (callback)
        {
          console.log("destroy connect start");
          testUtil.destroyConnection(connection, callback);
          console.log("destroy connect end");
        }
      ],
      done
    );
  });

  it('testSimpleSelectWithProxy', function (done)
  {
    var connection = snowflake.createConnection(connectionWithProxy);
    async.series(
      [
        function (callback)
        {
          testUtil.connect(connection, callback);
        },
        function (callback)
        {
          testUtil.executeCmd(
            connection,
            'create or replace table testProxy(colA string)',
            callback
          );
        },
        function (callback)
        {
          testUtil.executeCmd(
            connection,
            'insert into testProxy values(\'testString\')',
            callback
          );
        },
        function (callback)
        {
          testUtil.executeQueryAndVerify(
            connection,
            'select * from testProxy',
            [{ 'COLA': 'testString' }],
            callback
          );
        },
        function (callback)
        {
          testUtil.executeCmd(
            connection,
            'drop table if exists testProxy',
            callback
          );
        }
      ],
      done
    );
  });
});
