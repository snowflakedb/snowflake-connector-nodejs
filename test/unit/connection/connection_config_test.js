/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const ConnectionConfig = require('./../../../lib/connection/connection_config');
const ErrorCodes = require('./../../../lib/errors').codes;
const assert = require('assert');

describe('ConnectionConfig: basic', function () {
  ///////////////////////////////////////////////////////////////////////////
  //// Test synchronous errors                                           ////
  ///////////////////////////////////////////////////////////////////////////

  const negativeTestCases =
    [
      {
        name: 'missing options',
        options: undefined,
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_OPTIONS
      },
      {
        name: 'null options',
        options: null,
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_OPTIONS
      },
      {
        name: 'invalid options',
        options: 'invalid',
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_OPTIONS
      },
      {
        name: 'missing username',
        options: {},
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_USERNAME
      },
      {
        name: 'missing username with SNOWFLAKE authenticator',
        options:
          {
            authenticator: 'SNOWFLAKE'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_USERNAME
      },
      {
        name: 'missing browser timeout with EXTERNALBROWSER authenticator',
        options:
          {
            authenticator: 'EXTERNALBROWSER',
            username: 'admin',
            account: 'snowflake',
            browserActionTimeout: -1
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_BROWSER_TIMEOUT
      },
      {
        name: 'missing username with SNOWFLAKE_JWT authenticator',
        options:
          {
            authenticator: 'SNOWFLAKE_JWT'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_USERNAME
      },
      {
        name: 'undefined username',
        options:
          {
            username: undefined
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_USERNAME
      },
      {
        name: 'undefined username with SNOWFLAKE authenticator',
        options:
          {
            username: undefined,
            authenticator: 'SNOWFLAKE'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_USERNAME
      },
      {
        name: 'undefined username with SNOWFLAKE_JWT authenticator',
        options:
          {
            username: undefined,
            authenticator: 'SNOWFLAKE_JWT'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_USERNAME
      },
      {
        name: 'null username',
        options:
          {
            username: null
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_USERNAME
      },
      {
        name: 'null username with SNOWFLAKE authenticator',
        options:
          {
            username: null,
            authenticator: 'SNOWFLAKE'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_USERNAME
      },
      {
        name: 'null username with SNOWFLAKE_JWT authenticator',
        options:
          {
            username: null,
            authenticator: 'SNOWFLAKE_JWT'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_USERNAME
      },
      {
        name: 'invalid username',
        options:
          {
            username: 0
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_USERNAME
      },
      {
        name: 'invalid username with SNOWFLAKE authenticator',
        options:
          {
            username: 0,
            authenticator: 'SNOWFLAKE'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_USERNAME
      },
      {
        name: 'invalid username with OAUTH authenticator',
        options:
          {
            username: 0,
            authenticator: 'OAUTH'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_USERNAME
      },
      {
        name: 'invalid username with EXTERNALBROWSER authenticator',
        options:
          {
            username: 0,
            authenticator: 'EXTERNALBROWSER'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_USERNAME
      },
      {
        name: 'invalid username with SNOWFLAKE_JWT authenticator',
        options:
          {
            username: 0,
            authenticator: 'SNOWFLAKE_JWT'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_USERNAME
      },
      {
        name: 'missing password',
        options:
          {
            username: 'username'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_PASSWORD
      },
      {
        name: 'undefined password',
        options:
          {
            username: 'username',
            password: undefined
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_PASSWORD
      },
      {
        name: 'null password',
        options:
          {
            username: 'username',
            password: null
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_PASSWORD
      },
      {
        name: 'invalid password',
        options:
          {
            username: 'username',
            password: 0
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_PASSWORD
      },
      {
        name: 'missing account',
        options:
          {
            username: 'username',
            password: 'password'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_ACCOUNT
      },
      {
        name: 'undefined account',
        options:
          {
            username: 'username',
            password: 'password',
            account: undefined
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_ACCOUNT
      },
      {
        name: 'null account',
        options:
          {
            username: 'username',
            password: 'password',
            account: null
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_ACCOUNT
      },
      {
        name: 'invalid account',
        options:
          {
            username: 'username',
            password: 'password',
            account: 0
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_ACCOUNT
      },
      {
        name: 'account with invalid character',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account?'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_ACCOUNT_REGEX
      },
      {
        name: 'account starting with invalid character',
        options:
          {
            username: 'username',
            password: 'password',
            account: '?account'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_ACCOUNT_REGEX
      },
      {
        name: 'account starting with -',
        options:
          {
            username: 'username',
            password: 'password',
            account: '-account'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_ACCOUNT_REGEX
      },
      {
        name: 'account ending with -',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account-'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_ACCOUNT_REGEX
      },
      {
        name: 'account starting and ending with -',
        options:
          {
            username: 'username',
            password: 'password',
            account: '-account-'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_ACCOUNT_REGEX
      },
      {
        name: 'account with invalid character in the middle',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'acco?unt'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_ACCOUNT_REGEX
      },
      {
        name: 'account with subdomain with invalid character',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account.subdomain?'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_ACCOUNT_REGEX
      },
      {
        name: 'account with subdomain with invalid character in the middle',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account.sub?domain'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_ACCOUNT_REGEX
      },
      {
        name: 'region starting with -',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            region: '-region'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_REGION_REGEX
      },
      {
        name: 'region ending with -',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            region: 'region-'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_REGION_REGEX
      },
      {
        name: 'region starting with invalid character',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            region: '?region'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_REGION_REGEX
      },
      {
        name: 'region with invalid character',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            region: 'region?'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_REGION_REGEX
      },
      {
        name: 'region with invalid character in the middle',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            region: 'reg?ion'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_REGION_REGEX
      },
      {
        name: 'invalid warehouse',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            warehouse: 0
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_WAREHOUSE
      },
      {
        name: 'invalid database',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            database: 0
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_DATABASE
      },
      {
        name: 'invalid schema',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            schema: 0
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_SCHEMA
      },
      {
        name: 'invalid role',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            role: 0
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_ROLE
      },
      {
        name: 'missing proxyHost',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            proxyPort: ''
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_PROXY_HOST
      },
      {
        name: 'invalid proxyHost',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            proxyHost: 0
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_PROXY_HOST
      },
      {
        name: 'missing proxyPort',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            proxyHost: 'proxyHost'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_PROXY_PORT
      },
      {
        name: 'invalid proxyPort',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            proxyHost: 'proxyHost',
            proxyPort: 'proxyPort'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_PROXY_PORT
      },
      {
        name: 'missing proxyUser',
        options:
        {
          username: 'username',
          password: 'password',
          account: 'account',
          proxyHost: 'proxyHost',
          proxyPort: 1234,
          proxyPassword: 'proxyPassword'
        },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_PROXY_USER
      },
      {
        name: 'invalid proxyUser',
        options:
        {
          username: 'username',
          password: 'password',
          account: 'account',
          proxyHost: 'proxyHost',
          proxyPort: 1234,
          proxyUser: 1234
        },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_PROXY_USER
      },

      {
        name: 'missing proxyPassword',
        options:
        {
          username: 'username',
          password: 'password',
          account: 'account',
          proxyHost: 'proxyHost',
          proxyPort: 1234,
          proxyUser: 'proxyUser'
        },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_PROXY_PASS
      },
      {
        name: 'invalid proxyPassword',
        options:
        {
          username: 'username',
          password: 'password',
          account: 'account',
          proxyHost: 'proxyHost',
          proxyPort: 1234,
          proxyUser: 'proxyUser',
          proxyPassword: 1234
        },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_PROXY_PASS
      },
      {
        name: 'invalid noProxy',
        options:
      {
        username: 'username',
        password: 'password',
        account: 'account',
        proxyHost: 'proxyHost',
        proxyPort: 1234,
        proxyUser: 'proxyUser',
        proxyPassword: 'proxyPassword',
        noProxy: 0
      },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_NO_PROXY
      },
      {
        name: 'invalid streamResult',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            streamResult: 'invalid'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_STREAM_RESULT
      },
      {
        name: 'invalid fetchAsString',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            fetchAsString: 'invalid'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_FETCH_AS_STRING
      },
      {
        name: 'invalid fetchAsString values',
        options:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            fetchAsString: ['invalid']
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_FETCH_AS_STRING_VALUES
      },
      {
        name: 'invalid private key value',
        options:
        {
          username: 'username',
          password: 'password',
          account: 'account',
          privateKey: 'abcd',
          authenticator: 'SNOWFLAKE_JWT'
        },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_PRIVATE_KEY
      },
      {
        name: 'invalid private key path',
        options:
        {
          username: 'username',
          password: 'password',
          account: 'account',
          privateKeyPath: 1234,
          authenticator: 'SNOWFLAKE_JWT'
        },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_PRIVATE_KEY_PATH
      },
      {
        name: 'invalid private key pass',
        options:
        {
          username: 'username',
          password: 'password',
          account: 'account',
          privateKeyPass: 1234,
          authenticator: 'SNOWFLAKE_JWT'
        },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_PRIVATE_KEY_PASS
      },
      {
        name: 'invalid oauth token',
        options:
        {
          username: 'username',
          password: 'password',
          account: 'account',
          token: 1234,
          authenticator: 'OAUTH'
        },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_OAUTH_TOKEN
      },
      {
        name: 'invalid validateDefaultParameters',
        options:
        {
          username: 'username',
          password: 'password',
          account: 'account',
          validateDefaultParameters: 2
        },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_VALIDATE_DEFAULT_PARAMETERS
      },
      {
        name: 'invalid application name',
        options:
        {
          username: 'username',
          password: 'password',
          account: 'account',
          application: '123Test'
        },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_APPLICATION
      },
      {
        name: 'invalid application length',
        options:
        {
          username: 'username',
          password: 'password',
          account: 'account',
          application: '0123456789012345678901!%$##234567890123456789012345678901234567890'
        },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_APPLICATION
      },
      {
        name: 'invalid gcsUseDownscopedCredential',
        options:
        {
          username: 'username',
          password: 'password',
          account: 'account',
          gcsUseDownscopedCredential: 1234
        },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_GCS_USE_DOWNSCOPED_CREDENTIAL
      },
      {
        name: 'invalid disableQueryContextCache',
        options:
        {
          username: 'username',
          password: 'password',
          account: 'account',
          disableQueryContextCache: 1234
        },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_DISABLED_QUERY_CONTEXT_CACHE,
      },
      {
        name: 'invalid includeRetryReason',
        options:
        {
          username: 'username',
          password: 'password',
          account: 'account',
          includeRetryReason: 'invalid'
        },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_INCLUDE_RETRY_REASON,
      },
      {
        name: 'invalid clientStoreTemporaryCredential',
        options:
        {
          username: 'username',
          password: 'password',
          account: 'account',
          clientStoreTemporaryCredential: 'invalid'
        },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_CLIENT_STORE_TEMPORARY_CREDENTIAL,
      },
      {
        name: 'invalid clientConfigFile',
        options: {
          account: 'account',
          username: 'username',
          password: 'password',
          clientConfigFile: 15
        },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_CLIENT_CONFIG_FILE
      },
      {
        name: 'invalid retryTimeout',
        options: {
          account: 'account',
          username: 'username',
          password: 'password',
          retryTimeout: 'invalid'
        },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_MAX_LOGIN_TIMEOUT
      },
      {
        name: 'invalid clientRequestMFAToken',
        options: {
          username: 'username',
          password: 'password',
          account: 'account',
          clientRequestMFAToken: 'invalid'
        },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_CLIENT_REQUEST_MFA_TOKEN,
      },
      {
        name: 'invalid disableConsoleLogin',
        options: {
          account: 'account',
          username: 'username',
          password: 'password',
          disableConsoleLogin: 'invalid'
        },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_DISABLE_CONSOLE_LOGIN
      },
      {
        name: 'invalid disableGCPTokenUpload',
        options: {
          account: 'account',
          username: 'username',
          password: 'password',
          forceGCPUseDownscopedCredential: 'invalid'
        },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_FORCE_GCP_USE_DOWNSCOPED_CREDENTIAL
      },
      {

        name: 'invalid representNullAsStringNull',
        options: {
          account: 'account',
          username: 'username',
          password: 'password',
          representNullAsStringNull: 'invalid'
        },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_REPRESENT_NULL_AS_STRING_NULL
      },
      {
        name: 'invalid disableSamlURLCheck',

        options: {
          account: 'account',
          username: 'username',
          password: 'password',
          disableSamlURLCheck: 'invalid'
        },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_DISABLE_SAML_URL_CHECK
      },
    ];

  const createNegativeITCallback = function (testCase) {
    return function () {
      let error;

      try {
        new ConnectionConfig(testCase.options);
      } catch (err) {
        error = err;
      } finally {
        assert.ok(error);
        assert.strictEqual(error.code, testCase.errorCode);
      }
    };
  };

  let index, length, testCase;
  for (index = 0, length = negativeTestCases.length; index < length; index++) {
    testCase = negativeTestCases[index];
    it(testCase.name, createNegativeITCallback(testCase));
  }

  ///////////////////////////////////////////////////////////////////////////
  //// Test valid arguments                                              ////
  ///////////////////////////////////////////////////////////////////////////

  const testCases =
    [
      {
        name: 'basic',
        input:
          {
            username: 'username',
            password: 'password',
            account: 'account'
          },
        options:
          {
            accessUrl: 'https://account.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'account'
          }
      },
      {
        name: 'region (deprecated)',
        input:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            region: 'testregion',
          },
        options:
          {
            accessUrl: 'https://account.testregion.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'account'
          }
      },
      {
        name: 'region in account (deprecated)',
        input:
          {
            username: 'username',
            password: 'password',
            account: 'account.testregion.azure',
          },
        options:
          {
            accessUrl: 'https://account.testregion.azure.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'account',
            region: 'testregion.azure'
          }
      },
      {
        name: 'override region from account',
        input:
          {
            username: 'username',
            password: 'password',
            account: 'account.region.from.account',
            region: 'region'
          },
        options:
          {
            accessUrl: 'https://account.region.from.account.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'account',
            region: 'region.from.account',
          }
      },
      {
        name: 'account in url and no account is specified',
        input:
          {
            username: 'username',
            password: 'password',
            accessUrl: 'https://account1.testregion.azure.snowflakecomputing.com',
          },
        options:
          {
            accessUrl: 'https://account1.testregion.azure.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'account1'
          }
      },
      {
        name: 'account in url and account is specified',
        input:
          {
            username: 'username',
            password: 'password',
            account: 'account2',
            accessUrl: 'https://account1.testregion.azure.snowflakecomputing.com',
          },
        options:
          {
            accessUrl: 'https://account1.testregion.azure.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'account2'
          }
      },
      {
        name: 'region in account but accessUrl is specified',
        input:
          {
            accessUrl: 'https://account.prodregion.aws.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'account.testregion.azure',
          },
        options:
          {
            accessUrl: 'https://account.prodregion.aws.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'account'
          }
      },
      {
        name: 'region is us-west-2',
        input:
          {
            username: 'username',
            password: 'password',
            account: 'account',
            region: 'us-west-2',
          },
        options:
          {
            accessUrl: 'https://account.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'account'
          }
      },
      {
        name: 'region is us-west-2 but account includes us-east-1',
        input:
          {
            username: 'username',
            password: 'password',
            account: 'account.us-east-1',
            region: 'us-west-2',
          },
        options:
          {
            accessUrl: 'https://account.us-east-1.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'account'
          }
      },
      {
        name: 'NOT global url',
        input:
          {
            username: 'username',
            password: 'password',
            account: 'account-123xyz.us-west-2',
          },
        options:
          {
            accessUrl: 'https://account-123xyz.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'account-123xyz'
          }
      },
      {
        name: 'global url',
        input:
          {
            username: 'username',
            password: 'password',
            account: 'account-123xyz.us-west-2.global',
          },
        options:
          {
            accessUrl: 'https://account-123xyz.us-west-2.global.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'account'
          }
      },
      {
        name: 'china url with account and cn region',
        input:
          {
            username: 'username',
            password: 'password',
            account: 'account-123xyz',
            region: 'cn-north-1'
          },
        options:
          {
            accessUrl: 'https://account-123xyz.cn-north-1.snowflakecomputing.cn',
            username: 'username',
            password: 'password',
            account: 'account-123xyz',
            region: 'cn-north-1'
          }
      },
      {
        name: 'china url with account and cn region upper case',
        input:
          {
            username: 'username',
            password: 'password',
            account: 'account-123xyz',
            region: 'CN-NORTH-1'
          },
        options:
          {
            accessUrl: 'https://account-123xyz.CN-NORTH-1.snowflakecomputing.cn',
            username: 'username',
            password: 'password',
            account: 'account-123xyz',
            region: 'CN-NORTH-1'
          }
      },
      {
        name: 'china url with accessUrl only',
        input:
          {
            accessUrl: 'https://account-123xyz.cn-north-1.snowflakecomputing.cn',
            username: 'username',
            password: 'password',
          },
        options:
          {
            accessUrl: 'https://account-123xyz.cn-north-1.snowflakecomputing.cn',
            username: 'username',
            password: 'password',
            account: 'account-123xyz',
          }
      },

      {
        name: 'china url with account contains region',
        input:
          {
            username: 'username',
            password: 'password',
            account: 'account-123xyz.cn-north-1',
          },
        options:
          {
            accessUrl: 'https://account-123xyz.cn-north-1.snowflakecomputing.cn',
            username: 'username',
            password: 'password',
            account: 'account-123xyz',
            region: 'cn-north-1'
          }
      },
      {
        name: 'china url using host',
        input:
          {
            host: 'account-123xyz.cn-north-1.snowflakecomputing.cn',
            username: 'username',
            password: 'password',
            account: 'account-123',
            region: 'ca-central-1'
          },
        options:
          {
            accessUrl: 'https://account-123xyz.cn-north-1.snowflakecomputing.cn',
            username: 'username',
            password: 'password',
            account: 'account-123',
            region: 'ca-central-1'
          }
      },
      {
        name: 'validate default parameters',
        input:
        {
          username: 'username',
          password: 'password',
          account: 'account',
          validateDefaultParameters: true
        },
        options:
        {
          accessUrl: 'https://account.snowflakecomputing.com',
          username: 'username',
          password: 'password',
          account: 'account',
        }
      },
      {
        name: 'application',
        input:
        {
          username: 'username',
          password: 'password',
          account: 'account',
          application: 'test123'
        },
        options:
        {
          accessUrl: 'https://account.snowflakecomputing.com',
          username: 'username',
          password: 'password'
        }
      },
      {
        name: 'proxy without user/password',
        input:
        {
          username: 'username',
          password: 'password',
          account: 'account',
          proxyHost: 'proxyHost',
          proxyPort: 1234,
        },
        options:
        {
          accessUrl: 'https://account.snowflakecomputing.com',
          username: 'username',
          password: 'password'
        }
      },
      {
        name: 'proxy with user/password',
        input:
        {
          username: 'username',
          password: 'password',
          account: 'account',
          proxyHost: 'proxyHost',
          proxyPort: 1234,
          proxyUser: 'proxyUser',
          proxyPassword: 'proxyPassword'
        },
        options:
        {
          accessUrl: 'https://account.snowflakecomputing.com',
          username: 'username',
          password: 'password'
        }
      },
      {
        name: 'proxy with noproxy',
        input:
        {
          username: 'username',
          password: 'password',
          account: 'account',
          proxyHost: 'proxyHost',
          proxyPort: 1234,
          proxyUser: 'proxyUser',
          proxyPassword: 'proxyPassword',
          noProxy: '*.snowflakecomputing.com'
        },
        options:
        {
          accessUrl: 'https://account.snowflakecomputing.com',
          username: 'username',
          password: 'password'
        }
      },
      {
        name: 'gcsUseDownscopedCredential',
        input:
        {
          username: 'username',
          password: 'password',
          account: 'account',
          gcsUseDownscopedCredential: true
        },
        options:
        {
          accessUrl: 'https://account.snowflakecomputing.com',
          username: 'username',
          password: 'password'
        }
      },
      {
        name: 'oauth without username',
        input:
        {
          account: 'account',
          authenticator: 'OAUTH',
          token: 'token'
        },
        options:
        {
          accessUrl: 'https://account.snowflakecomputing.com',
          account: 'account'
        }
      },
      {
        name: 'external browser without username and password',
        input:
        {
          account: 'account',
          authenticator: 'EXTERNALBROWSER'
        },
        options:
        {
          accessUrl: 'https://account.snowflakecomputing.com',
          account: 'account'
        }
      },
      {
        name: 'disableQueryContextCache',
        input:
        {
          username: 'username',
          password: 'password',
          account: 'account',
          disableQueryContextCache: true,
        },
        options:
        {
          accessUrl: 'https://account.snowflakecomputing.com',
          username: 'username',
          password: 'password',
        }
      },
      {
        name: 'client config file',
        input:
          {
            account: 'account',
            username: 'username',
            password: 'password',
            clientConfigFile: 'easy_logging_config.json'
          },
        options:
          {
            accessUrl: 'https://account.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'account',
            clientConfigFile: 'easy_logging_config.json'
          }
      },
      {
        name: 'retry time out',
        input:
          {
            account: 'account',
            username: 'username',
            password: 'password',
            retryTimeout: 1234,
          },
        options:
          {
            accessUrl: 'https://account.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'account',
          }
      },
      {
        name: 'account with the _',
        input:
          {
            account: 'acc_ount',
            username: 'username',
            password: 'password',
            retryTimeout: 1234,
          },
        options:
          {
            accessUrl: 'https://acc_ount.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'acc_ount',
          }
      },
      {
        name: 'only one letter account',
        input:
          {
            account: 'a',
            username: 'username',
            password: 'password',
            retryTimeout: 1234,
          },
        options:
          {
            accessUrl: 'https://a.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'a',
          }
      },
      {
        name: 'only one letter account and subdomain',
        input:
          {
            account: 'a.b',
            username: 'username',
            password: 'password',
            retryTimeout: 1234,
          },
        options:
          {
            accessUrl: 'https://a.b.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'a',
            region: 'b'
          }
      },
      {
        name: 'account with [-] in the middle',
        input:
          {
            account: 'a-b',
            username: 'username',
            password: 'password',
            retryTimeout: 1234,
          },
        options:
          {
            accessUrl: 'https://a-b.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'a-b',
          }
      },
      {
        name: 'account with [_] in the middle',
        input:
          {
            account: 'a_b',
            username: 'username',
            password: 'password',
            retryTimeout: 1234,
          },
        options:
          {
            accessUrl: 'https://a_b.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'a_b',
          }
      },
      {
        name: 'account with subdomain',
        input:
          {
            account: 'account.subdomain',
            username: 'username',
            password: 'password',
            retryTimeout: 1234,
          },
        options:
          {
            accessUrl: 'https://account.subdomain.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'account',
            region: 'subdomain',
          }
      },
      {
        name: 'account with subdomain with _ and -',
        input:
          {
            account: 'acc_ount.sub-domain.aws',
            username: 'username',
            password: 'password',
            retryTimeout: 1234,
          },
        options:
          {
            accessUrl: 'https://acc_ount.sub-domain.aws.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'acc_ount',
            region: 'sub-domain.aws',
          }
      },
      {
        name: 'region with _',
        input:
          {
            account: 'account',
            region: 'reg_ion',
            username: 'username',
            password: 'password',
            retryTimeout: 1234,
          },
        options:
          {
            accessUrl: 'https://account.reg_ion.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'account',
            region: 'reg_ion',
          }
      },
      {
        name: 'region with -',
        input:
          {
            account: 'account',
            region: 'reg-ion',
            username: 'username',
            password: 'password',
            retryTimeout: 1234,
          },
        options:
          {
            accessUrl: 'https://account.reg-ion.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'account',
            region: 'reg-ion',
          }
      },
      {
        name: 'long region',
        input:
          {
            account: 'account',
            region: 'region.region2.region3',
            username: 'username',
            password: 'password',
            retryTimeout: 1234,
          },
        options:
          {
            accessUrl: 'https://account.region.region2.region3.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'account',
            region: 'region.region2.region3',
          }
      },
      {
        name: 'host',
        input:
          {
            account: 'account',
            username: 'username',
            password: 'password',
            retryTimeout: 1234,
            host: 'host.sub-domain.snowflakecomputing.com'
          },
        options:
          {
            accessUrl: 'https://host.sub-domain.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'account'
          }
      },
      {
        name: 'accessUrl and host',
        input:
          {
            account: 'account',
            username: 'username',
            password: 'password',
            retryTimeout: 1234,
            host: 'host.snowflakecomputing.com',
            accessUrl: 'https://access-url.snowflakecomputing.com'
          },
        options:
          {
            accessUrl: 'https://access-url.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'account'
          }
      },
      {
        name: 'accessUrl and host no account',
        input:
          {
            username: 'username',
            password: 'password',
            retryTimeout: 1234,
            host: 'host.snowflakecomputing.com',
            accessUrl: 'https://access-url.snowflakecomputing.com'
          },
        options:
          {
            accessUrl: 'https://access-url.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            account: 'access-url'
          }
      },
      {
        name: 'host no account',
        input:
          {
            username: 'username',
            password: 'password',
            retryTimeout: 1234,
            host: 'host.snowflakecomputing.com',
          },
        options:
          {
            accessUrl: 'https://host.snowflakecomputing.com',
            username: 'username',
            password: 'password',
            host: 'host.snowflakecomputing.com',
            account: 'host'
          }
      },
      {
        name: 'host and port',
        input:
          {
            account: 'account',
            username: 'username',
            password: 'password',
            host: 'host.snowflakecomputing.com',
            port: 444
          },
        options:
          {
            accessUrl: 'https://host.snowflakecomputing.com:444',
            username: 'username',
            password: 'password',
            account: 'account'
          }
      },
      {
        name: 'protocol, host and port',
        input:
          {
            account: 'account',
            username: 'username',
            password: 'password',
            host: 'host.snowflakecomputing.com',
            port: 8082,
            protocol: 'http'
          },
        options:
          {
            accessUrl: 'http://host.snowflakecomputing.com:8082',
            username: 'username',
            password: 'password',
            account: 'account'
          }
      },
    ];

  const createItCallback = function (testCase) {
    return function () {
      const resultOptions = new ConnectionConfig(testCase.input);
      Object.keys(testCase.options).forEach(function (key) {
        const ref = testCase.options[key];
        const val = resultOptions[key];
        assert.strictEqual(val, ref);
      });
    };
  };

  for (index = 0, length = testCases.length; index < length; index++) {
    testCase = testCases[index];
    it(testCase.name, createItCallback(testCase));
  }

  it('custom prefetch', function () {
    const username = 'username';
    const password = 'password';
    const account = 'account';

    let connectionConfig = new ConnectionConfig(
      {
        username: username,
        password: password,
        account: account
      });

    // get the default value of the resultPrefetch parameter
    const resultPrefetchDefault = connectionConfig.getResultPrefetch();

    // create a ConnectionConfig object with a custom value for resultPrefetch
    const resultPrefetchCustom = resultPrefetchDefault + 1;
    connectionConfig = new ConnectionConfig(
      {
        username: username,
        password: password,
        account: account,
        resultPrefetch: resultPrefetchCustom
      });

    // verify that the custom value overrode the default value
    assert.strictEqual(
      connectionConfig.getResultPrefetch(), resultPrefetchCustom);
  });

  describe('test options and getter', function () {
    const mandatoryOption = {
      username: 'username',
      password: 'password',
      account: 'account'
    };

    const testCases =
    [
      {
        name: 'disableSamlURLCheck',
        input: {
          ...mandatoryOption,
          disableSamlURLCheck: true,
        },
        result: true,
        getter: 'getDisableSamlURLCheck',
      },
    ];

    testCases.forEach(({ name, input, result, getter }) => {
      it(name, function (){
        const connectionConfig = new ConnectionConfig(input);
        assert.strictEqual(connectionConfig[getter](), result);
      });
    });
  });
});

