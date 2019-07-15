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
        name: 'undefined username',
        options:
          {
            username: undefined
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
        name: 'invalid username',
        options:
          {
            username: 0
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
      }
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
      }
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