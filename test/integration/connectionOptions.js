/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
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
const snowflakeTestBrowserUser = process.env.SNOWFLAKE_TEST_BROWSER_USER;
const snowflakeTestPrivateKeyUser = process.env.SNOWFLAKE_JWT_TEST_USER;
const snowflakeTestPrivateKey = process.env.SNOWFLAKE_TEST_PRIVATE_KEY;
const snowflakeTestPrivateKeyPath = process.env.SNOWFLAKE_TEST_PRIVATE_KEY_PATH;
const snowflakeTestPrivateKeyPass = process.env.SNOWFLAKE_TEST_PRIVATE_KEY_PASS;
const snowflakeTestPrivateKeyPathUnencrypted = process.env.SNOWFLAKE_TEST_PRIVATE_KEY_PATH_UNENCRYPTED;
const snowflakeTestOauthUser = process.env.SNOWFLAKE_TEST_OAUTH_USER;
const snowflakeTestToken = process.env.SNOWFLAKE_TEST_OAUTH_TOKEN;
const snowflakeTestOktaUser = process.env.SNOWFLAKE_TEST_OKTA_USER;
const snowflakeTestOktaPass = process.env.SNOWFLAKE_TEST_OKTA_PASS;
const snowflakeTestOktaAuth = process.env.SNOWFLAKE_TEST_OKTA_AUTH;

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

var externalBrowser =
{
  accessUrl: accessUrl,
  username: snowflakeTestBrowserUser,
  account: snowflakeTestAccount,
  warehouse: snowflakeTestWarehouse,
  database: snowflakeTestDatabase,
  schema: snowflakeTestSchema,
  role: snowflakeTestRole,
  authenticator: 'EXTERNALBROWSER'
};

var externalBrowserMismatchUser =
{
  accessUrl: accessUrl,
  username: 'node',
  account: snowflakeTestAccount,
  authenticator: 'EXTERNALBROWSER'
};

var keypairPrivateKey =
{
  accessUrl: accessUrl,
  username: snowflakeTestPrivateKeyUser,
  account: snowflakeTestAccount,
  warehouse: snowflakeTestWarehouse,
  database: snowflakeTestDatabase,
  schema: snowflakeTestSchema,
  role: snowflakeTestRole,
  privateKey: snowflakeTestPrivateKey,
  authenticator: 'SNOWFLAKE_JWT'
};

var keypairPathEncrypted =
{
  accessUrl: accessUrl,
  username: snowflakeTestPrivateKeyUser,
  account: snowflakeTestAccount,
  warehouse: snowflakeTestWarehouse,
  database: snowflakeTestDatabase,
  schema: snowflakeTestSchema,
  role: snowflakeTestRole,
  privateKeyPath: snowflakeTestPrivateKeyPath,
  privateKeyPass: snowflakeTestPrivateKeyPass,
  authenticator: 'SNOWFLAKE_JWT'
};

var keypairPathUnencrypted =
{
  accessUrl: accessUrl,
  username: snowflakeTestPrivateKeyUser,
  account: snowflakeTestAccount,
  warehouse: snowflakeTestWarehouse,
  database: snowflakeTestDatabase,
  schema: snowflakeTestSchema,
  role: snowflakeTestRole,
  privateKeyPath: snowflakeTestPrivateKeyPathUnencrypted,
  authenticator: 'SNOWFLAKE_JWT'
};

var keypairWrongToken =
{
  accessUrl: accessUrl,
  username: 'node',
  account: snowflakeTestAccount,
  privateKey: snowflakeTestPrivateKey,
  authenticator: 'SNOWFLAKE_JWT'
};

var oauth =
{
  accessUrl: accessUrl,
  username: snowflakeTestOauthUser,
  account: snowflakeTestAccount,
  warehouse: snowflakeTestWarehouse,
  database: snowflakeTestDatabase,
  schema: snowflakeTestSchema,
  role: snowflakeTestRole,
  token: snowflakeTestToken,
  authenticator: 'OAUTH'
};

var oauthMismatchUser =
{
  accessUrl: accessUrl,
  username: 'node',
  account: snowflakeTestAccount,
  token: snowflakeTestToken,
  authenticator: 'OAUTH'
};

var okta =
{
  accessUrl: accessUrl,
  username: snowflakeTestOktaUser,
  password: snowflakeTestOktaPass,
  account: snowflakeTestAccount,
  warehouse: snowflakeTestWarehouse,
  database: snowflakeTestDatabase,
  schema: snowflakeTestSchema,
  role: snowflakeTestRole,
  authenticator: snowflakeTestOktaAuth
};

var privatelink =
{
  accessUrl: accessUrl,
  username: snowflakeTestUser,
  password: snowflakeTestPassword,
  account: snowflakeTestAccount + '.privatelink'
};

exports.valid = valid;
exports.snowflakeAccount = snowflakeAccount;
exports.wrongUserName = wrongUserName;
exports.wrongPwd = wrongPwd;
exports.accessUrl = accessUrl;
exports.account = snowflakeTestAccount;
exports.externalBrowser = externalBrowser;
exports.externalBrowserMismatchUser = externalBrowserMismatchUser;
exports.keypairPrivateKey = keypairPrivateKey;
exports.keypairPathEncrypted = keypairPathEncrypted;
exports.keypairPathUnencrypted = keypairPathUnencrypted;
exports.keypairWrongToken = keypairWrongToken;
exports.oauth = oauth;
exports.oauthMismatchUser = oauthMismatchUser;
exports.okta = okta;
exports.privatelink = privatelink;
