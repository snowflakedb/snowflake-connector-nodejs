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
const snowflakeOauthClientID = process.env.SNOWFLAKE_TEST_OAUTH_CLIENT_ID;
const snowflakeOauthClientSecret = process.env.SNOWFLAKE_TEST_OAUTH_CLIENT_SECRET;
const oauthAuthorizationUrl = process.env.SNOWFLAKE_TEST_OAUTH_AUTHORIZATION_URL;
const oauthTokenRequestUrl = process.env.SNOWFLAKE_TEST_OAUTH_TOKEN_REQUEST_URL;
const oauthRedirectUri = process.env.SNOWFLAKE_TEST_OAUTH_REDIRECT_UIR;

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

const accessUrl = snowflakeTestProtocol + '://' + snowflakeTestHost + ':' + snowflakeTestPort;

const valid = {
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

const snowflakeAccount =
  snowflakeTestAdminUser !== undefined
    ? {
        accessUrl: accessUrl,
        username: snowflakeTestAdminUser,
        password: snowflakeTestAdminPassword,
        account: 'snowflake',
      }
    : undefined;

const wrongUserName = {
  accessUrl: accessUrl,
  username: snowflakeTestUser,
  password: 'testWrongPass',
  account: snowflakeTestAccount,
};

const wrongPwd = {
  accessUrl: accessUrl,
  username: snowflakeTestUser,
  password: '',
  account: snowflakeTestAccount,
};

const MFA = {
  ...valid,
  authenticator: 'USER_PWD_MFA_AUTHENTICATOR',
  passcode: snowflakeTestPasscode,
};

const PAT = {
  ...valid,
  authenticator: 'PROGRAMMATIC_ACCESS_TOKEN',
  role: 'ANALYST',
};

const authorizationCodeOkta = {
  ...valid,
  accessUrl: null,
  authenticator: 'OAUTH_AUTHORIZATION_CODE',
  oauthClientId: snowflakeOauthClientID,
  oauthClientSecret: snowflakeOauthClientSecret,
  oauthAuthorizationUrl: oauthAuthorizationUrl,
  oauthTokenRequestUrl: oauthTokenRequestUrl,
  oauthRedirectUri: oauthRedirectUri,
};

const authorizationCodeSnowflake = {
  ...valid,
  // username: snowflakeOauthClientID,
  oauthClientId: snowflakeOauthClientID,
  oauthClientSecret: snowflakeOauthClientSecret,
  authenticator: 'OAUTH_AUTHORIZATION_CODE',
  oauthAuthorizationUrl: oauthAuthorizationUrl,
  oauthTokenRequestUrl: oauthTokenRequestUrl,
};

const clientCredentialSnowflake = {
  ...valid,
  username: '',
  oauthClientId: snowflakeOauthClientID,
  oauthClientSecret: snowflakeOauthClientSecret,
  oauthTokenRequestUrl: oauthTokenRequestUrl,
  authenticator: 'OAUTH_CLIENT_CREDENTIALS',
  enableExperimentalAuthentication: true,
};

const privatelink = {
  accessUrl: accessUrl,
  username: snowflakeTestUser,
  password: snowflakeTestPassword,
  account: snowflakeTestAccount + '.privatelink',
};

const connectionWithProxy = {
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
exports.PAT = PAT;
exports.authorizationCodeOkta = authorizationCodeOkta;
exports.authorizationCodeSnowflake = authorizationCodeSnowflake;
exports.clientCredentialSnowflake = clientCredentialSnowflake;
