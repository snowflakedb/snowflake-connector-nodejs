/*
 * Copyright (c) 2015-2018 Snowflake Computing Inc. All rights reserved.
 */
var snowflakeTestProtocol = process.env.SNOWFLAKE_TEST_PROTOCOL;
var snowflakeTestHost = process.env.SNOWFLAKE_TEST_HOST;
var snowflakeTestPort = process.env.SNOWFLAKE_TEST_PORT;
const snowflakeTestAccount = process.env.SNOWFLAKE_TEST_ACCOUNT;
const snowflakeTestUser = process.env.SNOWFLAKE_TEST_USER;
const snowflakeTestDatabase = process.env.SNOWFLAKE_TEST_DATABASE;
const snowflakeTestWarehouse = process.env.SNOWFLAKE_TEST_WAREHOUSE;
const snowflakeTestSchema = process.env.SNOWFLAKE_TEST_SCHEMA;
const snowflakeTestRole = process.env.SNOWFLAKE_TEST_ROLE;
const snowflakeTestPassword = process.env.SNOWFLAKE_TEST_PASSWORD;
const snowflakeTestAdminUser = process.env.SNOWFLAKE_TEST_ADMIN_USER;
const snowflakeTestAdminPassword = process.env.SNOWFLAKE_TEST_ADMIN_PASSWORD;

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

const accessUrl = snowflakeTestProtocol + '://' + snowflakeTestHost + ':' + snowflakeTestPort;

var valid =
  {
    accessUrl: accessUrl,
    username: snowflakeTestUser,
    password: snowflakeTestPassword,
    account: snowflakeTestAccount,
    warehouse: snowflakeTestWarehouse,
    database: snowflakeTestDatabase,
    schema: snowflakeTestSchema,
    role: snowflakeTestRole
  };

var snowflakeAccount = snowflakeTestAdminUser !== undefined ?
  {
    accessUrl: accessUrl,
    username: snowflakeTestAdminUser,
    password: snowflakeTestAdminPassword,
    account: 'snowflake'
  } : undefined;

var wrongUserName =
  {

    accessUrl: accessUrl,
    username: 'node',
    password: 'test',
    account: snowflakeTestAccount
  };

var wrongPwd =
  {

    accessUrl: accessUrl,
    username: 'nodejs',
    password: '',
    account: snowflakeTestAccount
  };

exports.valid = valid;
exports.snowflakeAccount = snowflakeAccount;
exports.wrongUserName = wrongUserName;
exports.wrongPwd = wrongPwd;
exports.accessUrl = accessUrl;
exports.account = snowflakeTestAccount;
