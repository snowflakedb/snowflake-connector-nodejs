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
const snowflakeTestPasscode = process.env.SNOWFLAKE_TEST_PASSCODE;

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

const valid =
  {
    accessUrl: accessUrl,
    username: snowflakeTestUser,
    password: snowflakeTestPassword,
    account: snowflakeTestAccount,
    warehouse: snowflakeTestWarehouse,
    database: snowflakeTestDatabase,
    schema: snowflakeTestSchema,
    role: snowflakeTestRole,
    host: snowflakeTestHost,
  };

const snowflakeAccount = snowflakeTestAdminUser !== undefined ?
  {
    accessUrl: accessUrl,
    username: snowflakeTestAdminUser,
    password: snowflakeTestAdminPassword,
    account: 'snowflake'
  } : undefined;

const wrongUserName =
  {
    accessUrl: accessUrl,
    username: snowflakeTestUser,
    password: 'testWrongPass',
    account: snowflakeTestAccount
  };

const wrongPwd =
  {
    accessUrl: accessUrl,
    username: snowflakeTestUser,
    password: '',
    account: snowflakeTestAccount
  };

const MFA = {
  ...valid,
  authenticator: 'USER_PWD_MFA_AUTHENTICATOR',
  passcode: snowflakeTestPasscode,
};

const privatelink =
{
  accessUrl: accessUrl,
  username: snowflakeTestUser,
  password: snowflakeTestPassword,
  account: snowflakeTestAccount + '.privatelink'
};

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

exports.valid = valid;
exports.snowflakeAccount = snowflakeAccount;
exports.wrongUserName = wrongUserName;
exports.wrongPwd = wrongPwd;
exports.accessUrl = accessUrl;
exports.account = snowflakeTestAccount;
exports.privatelink = privatelink;
exports.connectionWithProxy = connectionWithProxy;
exports.MFA = MFA;
