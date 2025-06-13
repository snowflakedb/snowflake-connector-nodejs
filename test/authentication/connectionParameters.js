const { authorizationCodeOkta, authorizationCodeSnowflake } = require('../integration/connectionOptions');
const snowflakeAuthTestProtocol = process.env.SNOWFLAKE_AUTH_TEST_PROTOCOL;
const snowflakeAuthTestHost = process.env.SNOWFLAKE_AUTH_TEST_HOST;
const snowflakeAuthTestPort = process.env.SNOWFLAKE_AUTH_TEST_PORT;
const snowflakeAuthTestAccount = process.env.SNOWFLAKE_AUTH_TEST_ACCOUNT;
const snowflakeAuthTestRole = process.env.SNOWFLAKE_AUTH_TEST_ROLE;
const snowflakeAuthTestBrowserUser = process.env.SNOWFLAKE_AUTH_TEST_BROWSER_USER;
const snowflakeAuthTestOktaAuth = process.env.SNOWFLAKE_AUTH_TEST_OKTA_AUTH;
const snowflakeAuthTestOktaUser = process.env.SNOWFLAKE_AUTH_TEST_OKTA_USER;
const snowflakeAuthTestOktaPass = process.env.SNOWFLAKE_AUTH_TEST_OKTA_PASS;
const snowflakeAuthTestOauthUrl = process.env.SNOWFLAKE_AUTH_TEST_OAUTH_URL;
const snowflakeAuthTestOauthClientId = process.env.SNOWFLAKE_AUTH_TEST_OAUTH_CLIENT_ID;
const snowflakeAuthTestOauthClientSecret = process.env.SNOWFLAKE_AUTH_TEST_OAUTH_CLIENT_SECRET;
const snowflakeAuthTestDatabase = process.env.SNOWFLAKE_AUTH_TEST_DATABASE;
const snowflakeAuthTestWarehouse = process.env.SNOWFLAKE_AUTH_TEST_WAREHOUSE;
const snowflakeAuthTestSchema = process.env.SNOWFLAKE_AUTH_TEST_SCHEMA;
const snowflakeAuthTestPrivateKeyPath = process.env.SNOWFLAKE_AUTH_TEST_PRIVATE_KEY_PATH;
const snowflakeAuthTestInvalidPrivateKeyPath = process.env.SNOWFLAKE_AUTH_TEST_INVALID_PRIVATE_KEY_PATH;
const snowflakeAuthTestPrivateKeyPassword = process.env.SNOWFLAKE_AUTH_TEST_PRIVATE_KEY_PASSWORD;
const snowflakeAuthTestEncryptedPrivateKeyPath = process.env.SNOWFLAKE_AUTH_TEST_ENCRYPTED_PRIVATE_KEY_PATH;
const snowflakeAuthTestOauthOktaClientId = process.env.SNOWFLAKE_AUTH_TEST_EXTERNAL_OAUTH_OKTA_CLIENT_ID;
const snowflakeAuthTestOauthOktaPassword = process.env.SNOWFLAKE_AUTH_TEST_EXTERNAL_OAUTH_OKTA_USER_PASSWORD;
const snowflakeAuthTestOauthOktaClientSecret = process.env.SNOWFLAKE_AUTH_TEST_EXTERNAL_OAUTH_OKTA_CLIENT_SECRET;
const snowflakeAuthTestOauthOktaClientToken = process.env.SNOWFLAKE_AUTH_TEST_EXTERNAL_OAUTH_OKTA_TOKEN;
const snowflakeAuthTestOauthOktaRedirectUri = process.env.SNOWFLAKE_AUTH_TEST_EXTERNAL_OAUTH_OKTA_REDIRECT_URI;
const snowflakeAuthTestOauthOktaAuthUrl = process.env.SNOWFLAKE_AUTH_TEST_EXTERNAL_OAUTH_OKTA_AUTH_URL;
const snowflakeAuthTestSnowflakeUser = process.env.SNOWFLAKE_AUTH_TEST_SNOWFLAKE_USER;
const snowflakeAuthTestSnowflakeInternalRole = process.env.SNOWFLAKE_AUTH_TEST_INTERNAL_OAUTH_SNOWFLAKE_ROLE;
const snowflakeAuthTestSnowflakeRedirectUri = process.env.SNOWFLAKE_AUTH_TEST_INTERNAL_OAUTH_SNOWFLAKE_REDIRECT_URI;
const snowflakeAuthTestSnowflakeClientSecret = process.env.SNOWFLAKE_AUTH_TEST_INTERNAL_OAUTH_SNOWFLAKE_CLIENT_SECRET;
const snowflakeAuthTestSnowflakeClientId = process.env.SNOWFLAKE_AUTH_TEST_INTERNAL_OAUTH_SNOWFLAKE_CLIENT_ID;
const snowflakeAuthTestSnowflakeWildcardsClientId = process.env.SNOWFLAKE_AUTH_TEST_INTERNAL_OAUTH_SNOWFLAKE_WILDCARDS_CLIENT_ID;
const snowflakeAuthTestSnowflakeWildcardsClientSecret = process.env.SNOWFLAKE_AUTH_TEST_INTERNAL_OAUTH_SNOWFLAKE_WILDCARDS_CLIENT_SECRET;

const accessUrlAuthTests = snowflakeAuthTestProtocol + '://' + snowflakeAuthTestHost + ':' +
    snowflakeAuthTestPort;

const baseParameters =
    {
      accessUrl: accessUrlAuthTests,
      account: snowflakeAuthTestAccount,
      role: snowflakeAuthTestRole,
      host: snowflakeAuthTestHost,
      warehouse: snowflakeAuthTestWarehouse,
      database: snowflakeAuthTestDatabase,
      schema: snowflakeAuthTestSchema,
    };

const externalBrowser =
    {
      ...baseParameters,
      username: snowflakeAuthTestBrowserUser,
      authenticator: 'EXTERNALBROWSER'
    };

const okta =
    {
      ...baseParameters,
      username: snowflakeAuthTestOktaUser,
      password: snowflakeAuthTestOktaPass,
      authenticator: snowflakeAuthTestOktaAuth
    };

const oauth =
    {
      ...baseParameters,
      username: snowflakeAuthTestOktaUser,
      authenticator: 'OAUTH'
    };

const oauthPATOnWiremock =
    {
      ...baseParameters,
      accessUrl: null,
      username: 'MOCK_USERNAME',
      account: 'MOCK_ACCOUNT_NAME',
      host: 'localhost',
      protocol: 'http',
      authenticator: 'PROGRAMMATIC_ACCESS_TOKEN',
    };

const oauthAuthorizationCodeOnWiremock =
    {
      ...baseParameters,
      accessUrl: null,
      username: 'MOCK_USERNAME',
      account: 'MOCK_ACCOUNT_NAME',
      host: '127.0.0.1',
      protocol: 'http',
      role: 'ANALYST',
      authenticator: 'OAUTH_AUTHORIZATION_CODE',
      oauthClientId: '123',
      oauthClientSecret: 'clientSecret',
      oauthAuthorizationUrl: 'http://localhost:8099/oauth/authorize',
      oauthRedirectUri: 'http://localhost:8009/snowflake/oauth-redirect',
      oauthScope: 'session:role:ANALYST test-scope',
      oauthHttpAllowed: true,
    };

const oauthClientCredentialsOnWiremock =
    {
      ...baseParameters,
      accessUrl: null,
      username: 'MOCK_USERNAME',
      account: 'MOCK_ACCOUNT_NAME',
      host: '127.0.0.1',
      protocol: 'http',
      role: 'ANALYST',
      authenticator: 'OAUTH_CLIENT_CREDENTIALS',
      oauthClientId: '123',
      oauthClientSecret: 'clientSecret',
      oauthHttpAllowed: true,
    };

const keypairPrivateKey =
    {
      ...baseParameters,
      username: snowflakeAuthTestOktaUser,
      authenticator: 'SNOWFLAKE_JWT'
    };

const keypairPrivateKeyPath =
    {
      ...baseParameters,
      username: snowflakeAuthTestOktaUser,
      privateKeyPath: snowflakeAuthTestPrivateKeyPath,
      authenticator: 'SNOWFLAKE_JWT'
    };

const keypairEncryptedPrivateKeyPath =
    {
      ...baseParameters,
      username: snowflakeAuthTestOktaUser,
      privateKeyPass: snowflakeAuthTestPrivateKeyPassword,
      privateKeyPath: snowflakeAuthTestEncryptedPrivateKeyPath,
      authenticator: 'SNOWFLAKE_JWT'
    };

const oauthOktaClientCredentials =
    {
      ...baseParameters,
      oauthClientId: snowflakeAuthTestOauthOktaClientId,
      oauthClientSecret: snowflakeAuthTestOauthOktaClientSecret,
      oauthTokenRequestUrl: snowflakeAuthTestOauthOktaClientToken,
      username: snowflakeAuthTestOauthOktaClientId,
      authenticator: 'OAUTH_CLIENT_CREDENTIALS'
    };

const PATCredentials =
    {
      ...baseParameters,
      username: snowflakeAuthTestOktaUser,
      authenticator: 'PROGRAMMATIC_ACCESS_TOKEN'
    };

const oauthSnowflakeAuthorizationCode =
    {
      ...baseParameters,
      username: snowflakeAuthTestOauthOktaClientId,
      role: snowflakeAuthTestSnowflakeInternalRole,
      oauthRedirectUri: snowflakeAuthTestSnowflakeRedirectUri,
      oauthClientSecret: snowflakeAuthTestSnowflakeClientSecret,
      oauthClientId: snowflakeAuthTestSnowflakeClientId,
      authenticator: 'OAUTH_AUTHORIZATION_CODE'
    };

const oauthSnowflakeWildcardsAuthorizationCode =
    {
      ...baseParameters,
      username: snowflakeAuthTestOauthOktaClientId,
      role: snowflakeAuthTestSnowflakeInternalRole,
      oauthClientSecret: snowflakeAuthTestSnowflakeWildcardsClientSecret,
      oauthClientId: snowflakeAuthTestSnowflakeWildcardsClientId,
      authenticator: 'OAUTH_AUTHORIZATION_CODE'
    };

const oauthOktaAuthorizationCode =
    {
      ...baseParameters,
      username: snowflakeAuthTestOktaUser,
      oauthClientSecret: snowflakeAuthTestOauthOktaClientSecret,
      oauthClientId: snowflakeAuthTestOauthOktaClientId,
      oauthRedirectUri: snowflakeAuthTestOauthOktaRedirectUri,
      oauthAuthorizationUrl: snowflakeAuthTestOauthOktaAuthUrl,
      oauthTokenRequestUrl: snowflakeAuthTestOauthOktaClientToken,
      authenticator: 'OAUTH_AUTHORIZATION_CODE'
    };

exports.externalBrowser = externalBrowser;
exports.okta = okta;
exports.oauth = oauth;
exports.oauthAuthorizationCodeOnWiremock = oauthAuthorizationCodeOnWiremock;
exports.oauthClientCredentialsOnWiremock = oauthClientCredentialsOnWiremock;
exports.oauthAuthorizationCode = authorizationCodeSnowflake;
exports.oauthAuthorizationCodeOkta = authorizationCodeOkta;
exports.keypairPrivateKey = keypairPrivateKey;
exports.keypairPrivateKeyPath = keypairPrivateKeyPath;
exports.keypairEncryptedPrivateKeyPath = keypairEncryptedPrivateKeyPath;
exports.snowflakeTestBrowserUser = snowflakeAuthTestBrowserUser;
exports.snowflakeAuthTestOktaUser = snowflakeAuthTestOktaUser;
exports.snowflakeAuthTestOktaPass = snowflakeAuthTestOktaPass;
exports.snowflakeAuthTestRole = snowflakeAuthTestRole;
exports.snowflakeAuthTestOauthClientId = snowflakeAuthTestOauthClientId;
exports.snowflakeAuthTestOauthClientSecret = snowflakeAuthTestOauthClientSecret;
exports.snowflakeAuthTestOauthUrl = snowflakeAuthTestOauthUrl;
exports.snowflakeAuthTestPrivateKeyPath = snowflakeAuthTestPrivateKeyPath;
exports.snowflakeAuthTestInvalidPrivateKeyPath = snowflakeAuthTestInvalidPrivateKeyPath;
exports.oauthPATOnWiremock = oauthPATOnWiremock;
exports.oauthOktaClientCredentials = oauthOktaClientCredentials;
exports.PATCredentials = PATCredentials;
exports.snowflakeAuthTestSnowflakeUser = snowflakeAuthTestSnowflakeUser;
exports.snowflakeAuthTestSnowflakeInternalRole = snowflakeAuthTestSnowflakeInternalRole;
exports.oauthSnowflakeAuthorizationCode = oauthSnowflakeAuthorizationCode;
exports.snowflakeAuthTestOauthOktaPassword = snowflakeAuthTestOauthOktaPassword;
exports.snowflakeAuthTestOauthOktaClientId = snowflakeAuthTestOauthOktaClientId;
exports.oauthSnowflakeWildcardsAuthorizationCode = oauthSnowflakeWildcardsAuthorizationCode;
exports.oauthOktaAuthorizationCode = oauthOktaAuthorizationCode;
