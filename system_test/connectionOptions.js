const externalAccount =
  {
    accessUrl: 'http://externalaccount.reg.local.snowflakecomputing.com:8082',
    username: 'snowman',
    password: 'test',
    account: 'externalaccount'
  };

let snowflakeTestProtocol = process.env.SNOWFLAKE_TEST_PROTOCOL;
let snowflakeTestHost = process.env.SNOWFLAKE_TEST_HOST;
let snowflakeTestPort = process.env.SNOWFLAKE_TEST_PORT;
let snowflakeTestProxyHost = process.env.SNOWFLAKE_TEST_PROXY_HOST;
let snowflakeTestProxyPort = process.env.SNOWFLAKE_TEST_PROXY_PORT;
const snowflakeTestProxyProtocol = process.env.SNOWFLAKE_TEST_PROXY_PROTOCOL;
const snowflakeTestProxyUser = process.env.SNOWFLAKE_TEST_PROXY_USER;
const snowflakeTestProxyPassword = process.env.SNOWFLAKE_TEST_PROXY_PASSWORD;
const snowflakeTestAccount = process.env.SNOWFLAKE_TEST_ACCOUNT;
const snowflakeTestUser = process.env.SNOWFLAKE_TEST_USER;
const snowflakeTestDatabase = process.env.SNOWFLAKE_TEST_DATABASE;
const snowflakeTestWarehouse = process.env.SNOWFLAKE_TEST_WAREHOUSE;
const snowflakeTestSchema = process.env.SNOWFLAKE_TEST_SCHEMA;
const snowflakeTestRole = process.env.SNOWFLAKE_TEST_ROLE;
const snowflakeTestPassword = process.env.SNOWFLAKE_TEST_PASSWORD;

if (snowflakeTestProtocol === undefined) {
  snowflakeTestProtocol = 'https';
}

if (snowflakeTestHost === undefined) {
  snowflakeTestHost = snowflakeTestAccount + '.snowflakecomputing.com';
}

if (snowflakeTestPort === undefined) {
  snowflakeTestPort = '443';
}

if (snowflakeTestProxyHost === undefined) {
  snowflakeTestProxyHost = 'localhost';
}

if (snowflakeTestProxyPort === undefined) {
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
    proxyPort: parseInt(snowflakeTestProxyPort, 10),
    proxyProtocol: snowflakeTestProxyProtocol,
    proxyUser: snowflakeTestProxyUser,
    proxyPassword: snowflakeTestProxyPassword,
  };

exports.externalAccount = externalAccount;
exports.connectionWithProxy = connectionWithProxy;