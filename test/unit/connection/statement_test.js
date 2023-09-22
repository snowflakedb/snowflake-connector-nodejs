/*
 * Copyright (c) 2015 Snowflake Computing Inc. All rights reserved.
 */

var Statement = require('./../../../lib/connection/statement');
var ErrorCodes = require('./../../../lib/errors').codes;
var assert = require('assert');

describe('Statement.execute()', function ()
{
  ///////////////////////////////////////////////////////////////////////////
  //// Test synchronous errors                                          ////
  //////////////////////////////////////////////////////////////////////////

  var testCases =
    [
      {
        name: 'execute() missing options',
        options: {},
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_MISSING_OPTIONS
      },
      {
        name: 'execute() undefined options',
        options:
          {
            statementOptions: undefined
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_MISSING_OPTIONS
      },
      {
        name: 'execute() null options',
        options:
          {
            statementOptions: null
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_MISSING_OPTIONS
      },
      {
        name: 'execute() invalid options',
        options:
          {
            statementOptions: 'invalid'
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_OPTIONS
      },
      {
        name: 'execute() missing sql text',
        options:
          {
            statementOptions: {}
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_MISSING_SQL_TEXT
      },
      {
        name: 'execute() null sql text',
        options:
          {
            statementOptions: {sqlText: null}
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_MISSING_SQL_TEXT
      },
      {
        name: 'execute() undefined sql text',
        options:
          {
            statementOptions: {sqlText: undefined}
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_MISSING_SQL_TEXT
      },
      {
        name: 'execute() invalid sql text',
        options:
          {
            statementOptions: {sqlText: 0}
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_SQL_TEXT
      },
      {
        name: 'execute() invalid binds',
        options:
          {
            statementOptions:
              {
                sqlText: '',
                binds: 'invalid'
              }
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_BINDS
      },
      {
        name: 'execute() invalid bind values',
        options:
          {
            statementOptions:
              {
                sqlText: '',
                binds: [function ()
                        {
                        }]
              }
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_BIND_VALUES
      },
      {
        name: 'execute() invalid parameters',
        options:
          {
            statementOptions:
              {
                sqlText: '',
                parameters: 'invalid'
              }
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_PARAMETERS
      },
      {
        name: 'execute() invalid complete',
        options:
          {
            statementOptions:
              {
                sqlText: '',
                complete: 'invalid'
              }
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_COMPLETE
      },
      {
        name: 'execute() invalid streamResult',
        options:
          {
            statementOptions:
              {
                sqlText: '',
                streamResult: 'invalid'
              }
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_STREAM_RESULT
      },
      {
        name: 'execute() invalid fetchAsString',
        options:
          {
            statementOptions:
              {
                sqlText: '',
                fetchAsString: 'invalid'
              }
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_FETCH_AS_STRING
      },
      {
        name: 'execute() invalid fetchAsString values',
        options:
          {
            statementOptions:
              {
                sqlText: '',
                fetchAsString: ['invalid']
              }
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_FETCH_AS_STRING_VALUES
      },
      {
        name: 'execute() missing services',
        options:
          {
            statementOptions: {sqlText: 'sqlText'}
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'execute() missing connectionConfig',
        options:
          {
            statementOptions: {sqlText: 'sqlText'},
            services: {}
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'execute() invalid request id with sqlText',
        options:
          {
            statementOptions: {sqlText: 'sqlText', requestId: 1234},
            services: {},
            connectionConfig: null
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_REQUEST_ID
      },
      {
        name: 'execute() invalid request id without sqlText',
        options:
          {
            statementOptions: {requestId: 1234},
            services: {},
            connectionConfig: null
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_INVALID_REQUEST_ID
      },
      {
        name: 'execute() missing sqlText and requestId',
        options:
          {
            statementOptions: {},
            services: {},
            connectionConfig: null
          },
        errorCode: ErrorCodes.ERR_CONN_EXEC_STMT_MISSING_SQL_TEXT
      }
    ];

  var createItCallback = function (testCase)
  {
    return function ()
    {
      var options;
      var error;

      try
      {
        options = testCase.options;

        Statement.createStatementPreExec(
          options.statementOptions,
          options.services,
          options.connectionConfig);
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
  for (index = 0, length = testCases.length; index < length; index++)
  {
    testCase = testCases[index];
    it(testCase.name, createItCallback(testCase));
  }
});

describe('Statement.fetchResult()', function ()
{
  ///////////////////////////////////////////////////////////////////////////
  //// Test synchronous errors                                          ////
  //////////////////////////////////////////////////////////////////////////

  var testCases =
    [
      {
        name: 'fetchResult() undefined options',
        options:
          {
            statementOptions: undefined
          },
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_MISSING_OPTIONS
      },
      {
        name: 'fetchResult() null options',
        options:
          {
            statementOptions: null,
            services: null,
            connectionConfig: null
          },
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_MISSING_OPTIONS
      },
      {
        name: 'fetchResult() invalid options',
        options:
          {
            statementOptions: 'invalid'
          },
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_INVALID_OPTIONS
      },
      {
        name: 'fetchResult() missing query id',
        options:
          {
            statementOptions: {}
          },
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_MISSING_QUERY_ID
      },
      {
        name: 'fetchResult() undefined query id',
        options:
          {
            statementOptions: {queryId: undefined}
          },
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_MISSING_QUERY_ID
      },
      {
        name: 'fetchResult() null query id',
        options:
          {
            statementOptions: {queryId: null}
          },
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_MISSING_QUERY_ID
      },
      {
        name: 'fetchResult() invalid query id',
        options:
          {
            statementOptions: {queryId: 0}
          },
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_INVALID_QUERY_ID
      },
      {
        name: 'fetchResult() invalid complete',
        options:
          {
            statementOptions:
              {
                queryId: '',
                complete: 'invalid'
              }
          },
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_INVALID_COMPLETE
      },
      {
        name: 'fetchResult() invalid streamResult',
        options:
          {
            statementOptions:
              {
                queryId: '',
                streamResult: 'invalid'
              }
          },
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_INVALID_STREAM_RESULT
      },
      {
        name: 'fetchResult() invalid fetchAsString',
        options:
          {
            statementOptions:
              {
                queryId: '',
                fetchAsString: 'invalid'
              }
          },
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_INVALID_FETCH_AS_STRING
      },
      {
        name: 'fetchResult() invalid fetchAsString values',
        options:
          {
            statementOptions:
              {
                queryId: '',
                fetchAsString: ['invalid']
              }
          },
        errorCode: ErrorCodes.ERR_CONN_FETCH_RESULT_INVALID_FETCH_AS_STRING_VALUES
      },
      {
        name: 'fetchResult() missing services',
        options:
          {
            statementOptions: {queryId: 'foo'}
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'fetchResult() missing connectionConfig',
        options:
          {
            statementOptions: {queryId: 'foo'},
            services: {},
            connectionConfig: null
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'fetchResult() invali row mode',
        options:
          {
            statementOptions: {queryId: 'foo', rowMode: 'invalid'},
            services: {},
            connectionConfig: null
          },
        errorCode: ErrorCodes.ERR_STMT_STREAM_ROWS_INVALID_ROW_MODE
      }
    ];

  var createItCallback = function (testCase)
  {
    return function ()
    {
      var options;
      var error;

      try
      {
        options = testCase.options;
        Statement.createStatementPostExec(
          options.statementOptions,
          options.services,
          options.connectionConfig);
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
  for (index = 0, length = testCases.length; index < length; index++)
  {
    testCase = testCases[index];
    it(testCase.name, createItCallback(testCase));
  }
});