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
        name: 'case insensitive',
        input:
        {
          USERNAME: 'username',
          PassWord: 'password',
          AcCoUnT: 'account',
          ReGiOn: 'region',
        },
        options:
        {
          accessUrl: 'https://account.region.snowflakecomputing.com',
          username: 'username',
          password: 'password',
          account: 'account',
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

  var username = 'username';
  var password = 'password';
  var account = 'account';

  var connectionConfig = new ConnectionConfig(
    {
      username: username,
      password: password,
      account: account
    });

  it('custom prefetch', function ()
  {
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

  // external params
  it('custom timeout', function ()
  {
    // get the default value of the timeout parameter
    var resultTimeoutDefault = connectionConfig.getTimeout();

    // create a ConnectionConfig object with a custom value for timeout
    var resultTimeoutCustom = resultTimeoutDefault + 1;
    connectionConfig = new ConnectionConfig(
      {
        username: username,
        password: password,
        account: account,
        timeout: resultTimeoutCustom
      });

    // verify that the custom value overrode the default value
    assert.strictEqual(
      connectionConfig.getTimeout(), resultTimeoutCustom);
  });

  it('custom sf retry max login retries', function ()
  {
    // get the default value of the sfRetryMaxLoginRetries parameter
    var sfRetryMaxLoginRetriesDefault = connectionConfig.getRetrySfMaxLoginRetries();

    // create a ConnectionConfig object with a custom value for sfRetryMaxLoginRetries
    var sfRetryMaxLoginRetriesCustom = sfRetryMaxLoginRetriesDefault + 1;
    connectionConfig = new ConnectionConfig(
      {
        username: username,
        password: password,
        account: account,
        sfRetryMaxLoginRetries: sfRetryMaxLoginRetriesCustom
      });

    // verify that the custom value overrode the default value
    assert.strictEqual(
      connectionConfig.getRetrySfMaxLoginRetries(), sfRetryMaxLoginRetriesCustom);
  });

  // non-external params
  it('custom result stream interrupts', function ()
  {
    // get the default value of the resultStreamInterrupts parameter
    var resultStreamInterruptsDefault = connectionConfig.getResultStreamInterrupts();

    // create a ConnectionConfig object with a custom value for resultStreamInterrupts
    var resultStreamInterruptsCustom = resultStreamInterruptsDefault + 1;
    connectionConfig = new ConnectionConfig(
      {
        username: username,
        password: password,
        account: account,
        resultStreamInterrupts: resultStreamInterruptsCustom
      });

    // verify that the custom value does not override by the default value
    assert.strictEqual(
      connectionConfig.getResultStreamInterrupts(), resultStreamInterruptsDefault);
  });

  it('custom result chunk cache size', function ()
  {
    // get the default value of the resultChunkCacheSize parameter
    var resultChunkCacheSizeDefault = connectionConfig.getResultChunkCacheSize();

    // create a ConnectionConfig object with a custom value for resultChunkCacheSize
    var resultChunkCacheSizeCustom = resultChunkCacheSizeDefault + 1;
    connectionConfig = new ConnectionConfig(
      {
        username: username,
        password: password,
        account: account,
        resultChunkCacheSize: resultChunkCacheSizeCustom
      });

    // verify that the custom value does not override by the default value
    assert.strictEqual(
      connectionConfig.getResultChunkCacheSize(), resultChunkCacheSizeDefault);
  });

  it('custom result processing batch size', function ()
  {
    // get the default value of the resultProcessingBatchSize parameter
    var resultProcessingBatchSizeDefault = connectionConfig.getResultProcessingBatchSize();

    // create a ConnectionConfig object with a custom value for resultProcessingBatchSize
    var resultProcessingBatchSizeCustom = resultProcessingBatchSizeDefault + 1;
    connectionConfig = new ConnectionConfig(
      {
        username: username,
        password: password,
        account: account,
        resultProcessingBatchSize: resultProcessingBatchSizeCustom
      });

    // verify that the custom value does not override by the default value
    assert.strictEqual(
      connectionConfig.getResultProcessingBatchSize(), resultProcessingBatchSizeDefault);
  });

  it('custom result processing batch duration', function ()
  {
    // get the default value of the resultProcessingBatchDuration parameter
    var resultProcessingBatchDurationDefault = connectionConfig.getResultProcessingBatchDuration();

    // create a ConnectionConfig object with a custom value for resultProcessingBatchDuration
    var resultProcessingBatchDurationCustom = resultProcessingBatchDurationDefault + 1;
    connectionConfig = new ConnectionConfig(
      {
        username: username,
        password: password,
        account: account,
        resultProcessingBatchDuration: resultProcessingBatchDurationCustom
      });

    // verify that the custom value does not override by the default value
    assert.strictEqual(
      connectionConfig.getResultProcessingBatchDuration(), resultProcessingBatchDurationDefault);
  });

  it('custom row stream high water mark', function ()
  {
    // get the default value of the rowStreamHighWaterMark parameter
    var rowStreamHighWaterMarkDefault = connectionConfig.getRowStreamHighWaterMark();

    // create a ConnectionConfig object with a custom value for rowStreamHighWaterMark
    var rowStreamHighWaterMarkCustom = rowStreamHighWaterMarkDefault + 1;
    connectionConfig = new ConnectionConfig(
      {
        username: username,
        password: password,
        account: account,
        rowStreamHighWaterMark: rowStreamHighWaterMarkCustom
      });

    // verify that the custom value does not override by the default value
    assert.strictEqual(
      connectionConfig.getRowStreamHighWaterMark(), rowStreamHighWaterMarkDefault);
  });

  it('custom large result set retry max num retries', function ()
  {
    // get the default value of the largeResultSetRetryMaxNumRetries parameter
    var largeResultSetRetryMaxNumRetriesDefault = connectionConfig.getRetryLargeResultSetMaxNumRetries();

    // create a ConnectionConfig object with a custom value for largeResultSetRetryMaxNumRetries
    var largeResultSetRetryMaxNumRetriesCustom = largeResultSetRetryMaxNumRetriesDefault + 1;
    connectionConfig = new ConnectionConfig(
      {
        username: username,
        password: password,
        account: account,
        largeResultSetRetryMaxNumRetries: largeResultSetRetryMaxNumRetriesCustom
      });

    // verify that the custom value does not override by the default value
    assert.strictEqual(
      connectionConfig.getRetryLargeResultSetMaxNumRetries(), largeResultSetRetryMaxNumRetriesDefault);
  });

  it('custom large result set retry max sleep time', function ()
  {
    // get the default value of the largeResultSetRetryMaxSleepTime parameter
    var largeResultSetRetryMaxSleepTimeDefault = connectionConfig.getRetryLargeResultSetMaxSleepTime();

    // create a ConnectionConfig object with a custom value for largeResultSetRetryMaxSleepTime
    var largeResultSetRetryMaxSleepTimeCustom = largeResultSetRetryMaxSleepTimeDefault + 1;
    connectionConfig = new ConnectionConfig(
      {
        username: username,
        password: password,
        account: account,
        largeResultSetRetryMaxSleepTime: largeResultSetRetryMaxSleepTimeCustom
      });

    // verify that the custom value does not override by the default value
    assert.strictEqual(
      connectionConfig.getRetryLargeResultSetMaxSleepTime(), largeResultSetRetryMaxSleepTimeDefault);
  });

  it('custom sf retry max num retries', function ()
  {
    // get the default value of the sfRetryMaxNumRetries parameter
    var sfRetryMaxNumRetriesDefault = connectionConfig.getRetrySfMaxNumRetries();

    // create a ConnectionConfig object with a custom value for sfRetryMaxNumRetries
    var sfRetryMaxNumRetriesCustom = sfRetryMaxNumRetriesDefault + 1;
    connectionConfig = new ConnectionConfig(
      {
        username: username,
        password: password,
        account: account,
        sfRetryMaxNumRetries: sfRetryMaxNumRetriesCustom
      });

    // verify that the custom value does not override by the default value
    assert.strictEqual(
      connectionConfig.getRetrySfMaxNumRetries(), sfRetryMaxNumRetriesDefault);
  });

  it('custom sf retry starting sleep time', function ()
  {
    // get the default value of the sfRetryStartingSleepTime parameter
    var sfRetryStartingSleepTimeDefault = connectionConfig.getRetrySfStartingSleepTime();

    // create a ConnectionConfig object with a custom value for sfRetryStartingSleepTime
    var sfRetryStartingSleepTimeCustom = sfRetryStartingSleepTimeDefault + 1;
    connectionConfig = new ConnectionConfig(
      {
        username: username,
        password: password,
        account: account,
        sfRetryStartingSleepTime: sfRetryStartingSleepTimeCustom
      });

    // verify that the custom value does not override by the default value
    assert.strictEqual(
      connectionConfig.getRetrySfStartingSleepTime(), sfRetryStartingSleepTimeDefault);
  });

  it('custom sf retry max sleep time', function ()
  {
    // get the default value of the sfRetryMaxSleepTime parameter
    var sfRetryMaxSleepTimeDefault = connectionConfig.getRetrySfMaxSleepTime();

    // create a ConnectionConfig object with a custom value for sfRetryStartingSleepTime
    var sfRetryMaxSleepTimeCustom = sfRetryMaxSleepTimeDefault + 1;
    connectionConfig = new ConnectionConfig(
      {
        username: username,
        password: password,
        account: account,
        sfRetryMaxSleepTime: sfRetryMaxSleepTimeCustom
      });

    // verify that the custom value does not override by the default value
    assert.strictEqual(
      connectionConfig.getRetrySfMaxSleepTime(), sfRetryMaxSleepTimeDefault);
  });
});
