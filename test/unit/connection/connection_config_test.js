/*
 * Copyright (c) 2015 Snowflake Computing Inc. All rights reserved.
 */

var ConnectionConfig = require('./../../../lib/connection/connection_config');
var ErrorCodes = require('./../../../lib/errors').codes;
var assert = require('assert');

describe('ConnectionConfig: basic', function ()
{
  ///////////////////////////////////////////////////////////////////////////
  //// Test synchronous errors                                           ////
  ///////////////////////////////////////////////////////////////////////////

  var negativeTestCases =
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
    ];

  var createNegativeITCallback = function (testCase)
  {
    return function ()
    {
      var error;

      try
      {
        new ConnectionConfig(testCase.options);
      }
      catch (err)
      {
        error = err;
      }
      finally
      {
        assert.ok(error);
        assert.strictEqual(error.code, testCase.errorCode);
      }
    };
  };

  var index, length, testCase;
  for (index = 0, length = negativeTestCases.length; index < length; index++)
  {
    testCase = negativeTestCases[index];
    it(testCase.name, createNegativeITCallback(testCase));
  }

  ///////////////////////////////////////////////////////////////////////////
  //// Test valid arguments                                              ////
  ///////////////////////////////////////////////////////////////////////////

  var testCases =
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
            account: 'account'
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
            accessUrl: 'https://account-123xyz.us-west-2.snowflakecomputing.com',
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
          application: "test123"
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
          noProxy:  '*.snowflakecomputing.com'
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
          disableQueryContextCache: true
        },
        options:
        {
          accessUrl: 'https://account.snowflakecomputing.com',
          username: 'username',
          password: 'password'
        }
      },
    ];

  var createItCallback = function (testCase)
  {
    return function ()
    {
      var result_options = new ConnectionConfig(testCase.input);
      Object.keys(testCase.options).forEach(function (key)
      {
        var ref = testCase.options[key];
        var val = result_options[key];
        assert.strictEqual(val, ref);
      })
    };
  };

  for (index = 0, length = testCases.length; index < length; index++)
  {
    testCase = testCases[index];
    it(testCase.name, createItCallback(testCase));
  }

  it('custom prefetch', function ()
  {
    var username = 'username';
    var password = 'password';
    var account = 'account';

    var connectionConfig = new ConnectionConfig(
      {
        username: username,
        password: password,
        account: account
      });

    // get the default value of the resultPrefetch parameter
    var resultPrefetchDefault = connectionConfig.getResultPrefetch();

    // create a ConnectionConfig object with a custom value for resultPrefetch
    var resultPrefetchCustom = resultPrefetchDefault + 1;
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
});
