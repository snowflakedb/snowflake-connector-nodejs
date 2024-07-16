/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const Result = require('./../../../../lib/connection/result/result');
const ConnectionConfig = require('./../../../../lib/connection/connection_config');
const Util = require('./../../../../lib/util');
const ErrorCodes = require('./../../../../lib/errors').codes;
const assert = require('assert');

describe('Result: synchronous errors', function () {
  ///////////////////////////////////////////////////////////////////////////
  //// Test synchronous errors                                           ////
  ///////////////////////////////////////////////////////////////////////////

  const testCases =
    [
      {
        name: 'missing options',
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'undefined options',
        options: undefined,
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'null options',
        options: null,
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'empty options',
        options: {},
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'undefined response',
        options:
          {
            response: undefined
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'null response',
        options:
          {
            response: null
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'invalid response',
        options:
          {
            response: 'invalid'
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'missing statement',
        options:
          {
            response: {}
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'undefined statement',
        options:
          {
            response: {},
            statement: undefined
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'null statement',
        options:
          {
            response: {},
            statement: null
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'invalid statement',
        options:
          {
            response: {},
            statement: 'invalid'
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'missing http client',
        options:
          {
            response: {},
            statement: {}
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'undefined http client',
        options:
          {
            response: {},
            statement: {},
            services: undefined
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'null http client',
        options:
          {
            response: {},
            statement: {},
            services: null
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'invalid http client',
        options:
          {
            response: {},
            statement: {},
            services: 'invalid'
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'missing connection config',
        options:
          {
            response: {},
            statement: {},
            services: {}
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'undefined connection config',
        options:
          {
            response: {},
            statement: {},
            services: {},
            connectionConfig: undefined
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'null connection config',
        options:
          {
            response: {},
            statement: {},
            services: {},
            connectionConfig: null
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      }
    ];

  const createItCallback = function (testCase) {
    return function () {
      let error;

      try {
        new Result(testCase.options);
      } catch (err) {
        error = err;
      } finally {
        assert.ok(error);
        assert.strictEqual(error.code, testCase.errorCode);
      }
    };
  };

  let index, length, testCase;
  for (index = 0, length = testCases.length; index < length; index++) {
    testCase = testCases[index];
    it(testCase.name, createItCallback(testCase));
  }
});

exports.createResultOptions = function (response, connectionConfigOption = {}) {
  return {
    response: response,
    statement: {},
    services: {},
    connectionConfig: new ConnectionConfig(
      {
        username: 'username',
        password: 'password',
        account: 'account',
        accessUrl: 'http://account.snowflake.com',
        ...connectionConfigOption
      })
  };
};

exports.testResult = function (resultOptions, each, end, startIndex, endIndex) {
  // create a new result
  const result = new Result(resultOptions);

  let numIterationsActual = 0;

  // initiate a fetch-rows operation
  const operation = result.fetchRows(
    {
      startIndex: startIndex,
      endIndex: endIndex,

      each: function (row) {
        each(row);

        numIterationsActual++;
      }
    });

  // when the fetch-rows operation completes
  operation.on('complete', function (err, continueCallback) {
    // there should be no error
    assert.ok(!err);

    // the continue callback should be undefined (because there's no error)
    assert.ok(!Util.exists(continueCallback));

    let numIterationsExpected;

    if (Util.isNumber(startIndex) && Util.isNumber(endIndex)) {
      numIterationsExpected = endIndex - startIndex + 1;
    } else {
      numIterationsExpected = result.getTotalRows();
    }

    // check that we iterated through all the rows
    assert.strictEqual(numIterationsActual, numIterationsExpected);

    // invoke the end function
    end(result);
  });
};