const Core = require('./../../../lib/core');
const MockHttpClient = require('./mock_http_client');

const clientInfo =
  {
    version: require('./../../../package.json').version,
    environment: process.versions
  };

// create a snowflake instance that operates in qa mode and is configured to
// use a mock http client
const snowflake = Core(
  {
    qaMode: true,
    httpClient: new MockHttpClient(clientInfo),
    loggerClass: require('./../../../lib/logger/node'),
    client: clientInfo
  });

exports.snowflake = snowflake;

const connectionOptions =
  {
    accessUrl: 'http://fakeaccount.snowflakecomputing.com',
    username: 'fakeusername',
    password: 'fakepassword',
    account: 'fakeaccount',
    getPasscodeInPassword: () => false,
    getPasscode: () => null,  
    authenticator: 'SNOWFLAKE',
    getAuthenticator: () => 'SNOWFLAKE',
  };

const connectionOptionsDeserialize =
  {
    accessUrl: 'http://fakeaccount.snowflakecomputing.com'
  };

const connectionOptionsWithServiceName =
  {
    accessUrl: 'http://fakeaccount.snowflakecomputing.com',
    username: 'fakeuserservicename',
    password: 'fakepassword',
    account: 'fakeaccount'
  };

const connectionOptionsWithClientSessionKeepAlive =
  {
    accessUrl: 'http://fakeaccount.snowflakecomputing.com',
    username: 'fakeusername',
    password: 'fakepassword',
    account: 'fakeaccount',
    clientSessionKeepAlive: true,
    clientSessionKeepAliveHeartbeatFrequency: 1800
  };

const connectionOptionsForSessionGone =
  {
    accessUrl: 'http://fakeaccount.snowflakecomputing.com',
    username: 'fakesessiongone',
    password: 'fakepassword',
    account: 'fakeaccount'
  };

const connectionOptionsForSessionExpired =
  {
    accessUrl: 'http://fakeaccount.snowflakecomputing.com',
    username: 'fakesessionexpired',
    password: 'fakepassword',
    account: 'fakeaccount'
  };

const connectionOptions504 =
  {
    accessUrl: 'http://fake504.snowflakecomputing.com',
    username: 'fake504user',
    password: 'fakepassword',
    account: 'fake504'
  };

const connectionOptionsWithTreatIntAsBigInt =
  {
    accessUrl: 'http://fakeaccount.snowflakecomputing.com',
    username: 'fakeusername',
    password: 'fakepassword',
    account: 'fakeaccount',
    jsTreatIntegerAsBigInt: true
  };

const connectionOptionsDefault =
{
  accessUrl: 'http://fakeaccount.snowflakecomputing.com',
  username: 'fakeusername',
  password: 'fakepassword',
  account: 'fakeaccount',
  authenticator: 'SNOWFLAKE'
};

const connectionOptionsExternalBrowser =
{
  accessUrl: 'http://fakeaccount.snowflakecomputing.com',
  username: 'fakeusername',
  account: 'fakeaccount',
  authenticator: 'EXTERNALBROWSER'
};

const connectionOptionsidToken =
{
  accessUrl: 'http://fakeaccount.snowflakecomputing.com',
  username: 'fakeusername',
  account: 'fakeaccount',
  idToken: 'fakeIdToken',
  authenticator: 'EXTERNALBROWSER'
};

const connectionOptionsKeyPair =
{
  accessUrl: 'http://fakeaccount.snowflakecomputing.com',
  username: 'fakeusername',
  account: 'fakeaccount',
  getPrivateKey: () => 'fakeprivatekey',
  getPrivateKeyPath: () => '',
  getPrivateKeyPass: () => '',
  getAuthenticator: () => 'SNOWFLAKE_JWT',
  getServiceName: () => '',
  authenticator: 'SNOWFLAKE_JWT'
};

const connectionOptionsKeyPairPath =
{
  accessUrl: 'http://fakeaccount.snowflakecomputing.com',
  username: 'fakeusername',
  account: 'fakeaccount',
  getPrivateKey: () => '',
  getPrivateKeyPath: () => 'fakeprivatekeypath',
  getPrivateKeyPass: () => 'fakeprivatekeypass',
  authenticator: 'SNOWFLAKE_JWT'
};

const connectionOptionsOauth =
{
  accessUrl: 'http://fakeaccount.snowflakecomputing.com',
  username: 'fakeusername',
  account: 'fakeaccount',
  token: 'faketoken',
  authenticator: 'OAUTH'
};

const connectionOptionsOkta =
{
  accessUrl: 'http://fakeaccount.snowflakecomputing.com',
  username: 'fakeusername',
  account: 'fakeaccount',
  token: 'faketoken',
  getClientType: () => 'JavaScript',
  getClientVersion: () => '1.6.21',
  rawSamlResponse: '<form action="https://fakeaccount.snowflakecomputing.com/fed/login">',
  authenticator: 'https://dev-12345678.okta.com/',
  getAuthenticator: () => 'https://dev-12345678.okta.com/',
  getServiceName: () => '',
  getTimeout: () => 90,
  getRetryTimeout: () => 300,
  getRetrySfMaxLoginRetries: () => 7,
  getDisableSamlURLCheck: () => false
};

exports.connectionOptions =
  {
    default: connectionOptions,
    deserialize: connectionOptionsDeserialize,
    serviceName: connectionOptionsWithServiceName,
    clientSessionKeepAlive: connectionOptionsWithClientSessionKeepAlive,
    sessionGone: connectionOptionsForSessionGone,
    sessionExpired: connectionOptionsForSessionExpired,
    http504: connectionOptions504,
    treatIntAsBigInt: connectionOptionsWithTreatIntAsBigInt,
    authDefault: connectionOptionsDefault,
    authExternalBrowser: connectionOptionsExternalBrowser,
    authKeyPair: connectionOptionsKeyPair,
    authKeyPairPath: connectionOptionsKeyPairPath,
    authOauth: connectionOptionsOauth,
    authOkta: connectionOptionsOkta,
    authIdToken: connectionOptionsidToken,
  };
