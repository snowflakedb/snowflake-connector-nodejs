const snowflakeAuthTestProtocol = process.env.SNOWFLAKE_AUTH_TEST_PROTOCOL;
const snowflakeAuthTestHost = process.env.SNOWFLAKE_AUTH_TEST_HOST;
const snowflakeAuthTestPort = process.env.SNOWFLAKE_AUTH_TEST_PORT;
const snowflakeAuthTestAccount = process.env.SNOWFLAKE_AUTH_TEST_ACCOUNT;
const snowflakeAuthTestRole = process.env.SNOWFLAKE_AUTH_TEST_ROLE;
const snowflakeTestBrowserUser = process.env.SNOWFLAKE_AUTH_TEST_BROWSER_USER;
const snowflakeAuthTestOktaPass = process.env.SNOWFLAKE_AUTH_TEST_OKTA_PASS;
const snowflakeAuthTestDatabase = process.env.SNOWFLAKE_AUTH_TEST_DATABASE;
const snowflakeAuthTestWarehouse = process.env.SNOWFLAKE_AUTH_TEST_WAREHOUSE;
const snowflakeAuthTestSchema = process.env.SNOWFLAKE_AUTH_TEST_SCHEMA;

const accessUrlAuthTests = snowflakeAuthTestProtocol + '://' + snowflakeAuthTestHost + ':' +
  snowflakeAuthTestPort;

const externalBrowser =
  {
    accessUrl: accessUrlAuthTests,
    username: snowflakeTestBrowserUser,
    account: snowflakeAuthTestAccount,
    role: snowflakeAuthTestRole,
    host: snowflakeAuthTestHost,
    warehouse: snowflakeAuthTestWarehouse,
    database: snowflakeAuthTestDatabase,
    schema: snowflakeAuthTestSchema,
    authenticator: 'EXTERNALBROWSER'
  };

exports.externalBrowser = externalBrowser;
exports.snowflakeTestBrowserUser = snowflakeTestBrowserUser;
exports.snowflakeAuthTestOktaPass = snowflakeAuthTestOktaPass;
