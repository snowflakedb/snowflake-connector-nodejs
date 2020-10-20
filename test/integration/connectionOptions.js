/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
const fs = require('fs');
const crypto = require('crypto');

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
const snowflakeTestAdminUser = process.env.SNOWFLAKE_TEST_ADMIN_USER;
const snowflakeTestAdminPassword = process.env.SNOWFLAKE_TEST_ADMIN_PASSWORD;
const snowflakeTestPrivateKeyUser = process.env.SNOWFLAKE_TEST_PRIVATE_KEY_USER;
const snowflakeTestPrivateKeyPath = process.env.SNOWFLAKE_TEST_PRIVATE_KEY_PATH;
const snowflakeTestPrivateKeyPassphrase = process.env.SNOWFLAKE_TEST_PRIVATE_KEY_PASSPHRASE;

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

var getPrivateKey = function () {
  try {
    const privateKey = fs.readFileSync(snowflakeTestPrivateKeyPath, 'utf-8');
    const privateKeyPEM = crypto.createPrivateKey({
      key: privateKey,
      format: 'pem',
      passphrase: snowflakeTestPrivateKeyPassphrase,
    });

    return privateKeyPEM.export({ type: 'pkcs8', format: 'der' });
  }
  catch (err) {
    return 'invalid_private_key';
  }
};
var validKeyPairAuth =
  {
    accessUrl: accessUrl,
    username: snowflakeTestPrivateKeyUser,
    account: snowflakeTestAccount,
    privateKey: getPrivateKey(),
  };

exports.validKeyPairAuth = validKeyPairAuth;
exports.valid = valid;
exports.snowflakeAccount = snowflakeAccount;
exports.wrongUserName = wrongUserName;
exports.wrongPwd = wrongPwd;
exports.accessUrl = accessUrl;
exports.account = snowflakeTestAccount;
