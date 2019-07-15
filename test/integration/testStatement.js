/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
var snowflake = require('./../../lib/snowflake');
var assert = require('assert');
var async = require('async');
var connectionOptions = require('./connectionOptions');

describe('Statement Tests', function ()
{
  var connection = snowflake.createConnection(connectionOptions.valid);
  var sqlText = 'select 1 as "c1";';

  it('statement api', function (done)
  {
    var statement;

    async.series(
      [
        function (callback)
        {
          connection.connect(function (err, conn)
          {
            assert.ok(!err, 'there should be no error');
            assert.strictEqual(conn, connection,
              'the connect() callback should be invoked with the statement');

            callback();
          });
        },
        function (callback)
        {
          statement = connection.execute(
            {
              sqlText: sqlText,
              complete: function (err, stmt)
              {
                assert.ok(!err, 'there should be no error');
                assert.strictEqual(stmt, statement,
                  'the execute() callback should be invoked with the statement');

                // we should only have one column c1
                var columns = statement.getColumns();
                assert.ok(columns);
                assert.strictEqual(columns.length, 1);
                assert.ok(columns[0]);
                assert.strictEqual(columns[0].getName(), 'c1');

                assert.strictEqual(statement.getNumRows(), 1);
                assert.ok(statement.getSessionState());
                assert.ok(statement.getStatementId());

//          testStatementFetchRows(statement);

                callback();
              }
            });

          //testStatementFetchRows(statement);

          // the sql text should be the same as what was passed in
          assert.strictEqual(statement.getSqlText(), sqlText);

          // the rest of the properties won't be available until the statement is
          // complete (some of them will only be available if the statement succeeds)
          assert.strictEqual(statement.getColumns(), undefined);
          assert.strictEqual(statement.getNumRows(), undefined);
          assert.strictEqual(statement.getSessionState(), undefined);
          assert.strictEqual(statement.getStatementId(), undefined);
        },
        function (callback)
        {
          assert.ok(connection.isUp(), "not active");
          callback();
        },
        function (callback)
        {
          var rows = [];
          statement.fetchRows(
            {
              each: function (row)
              {
                rows.push(row);
              },
              end: function (err, stmt)
              {
                assert.ok(!err, 'there should be no error');
                assert.strictEqual(stmt, statement,
                  'the end() callback should be invoked with the statement');
                assert.strictEqual(rows.length, 1, 'there should only be one row');
                assert.strictEqual(rows[0].getColumnValue('c1').toJSNumber(), 1,
                  'the row should only have one column c1 and its value ' +
                  'should be 1');

                callback();
              }
            });
        }
      ],
      function ()
      {
        done();
      });
  });
});

function testStatementFetchRows(statement)
{
  var testCases =
    [
      {
        name: 'fetchRows() missing options',
        errorCode: ErrorCodes.ERR_STMT_FETCH_ROWS_MISSING_OPTIONS
      },
      {
        name: 'fetchRows() undefined options',
        options: undefined,
        errorCode: ErrorCodes.ERR_STMT_FETCH_ROWS_MISSING_OPTIONS
      },
      {
        name: 'fetchRows() null options',
        options: null,
        errorCode: ErrorCodes.ERR_STMT_FETCH_ROWS_MISSING_OPTIONS
      },
      {
        name: 'fetchRows() invalid options',
        options: 'invalid',
        errorCode: ErrorCodes.ERR_STMT_FETCH_ROWS_INVALID_OPTIONS
      },
      {
        name: 'fetchRows() missing each()',
        options: {},
        errorCode: ErrorCodes.ERR_STMT_FETCH_ROWS_MISSING_EACH
      },
      {
        name: 'fetchRows() undefined each()',
        options:
          {
            each: undefined
          },
        errorCode: ErrorCodes.ERR_STMT_FETCH_ROWS_MISSING_EACH
      },
      {
        name: 'fetchRows() null each()',
        options:
          {
            each: null
          },
        errorCode: ErrorCodes.ERR_STMT_FETCH_ROWS_MISSING_EACH
      },
      {
        name: 'fetchRows() invalid each()',
        options:
          {
            each: 'invalid'
          },
        errorCode: ErrorCodes.ERR_STMT_FETCH_ROWS_INVALID_EACH
      },
      {
        name: 'fetchRows() missing end()',
        options:
          {
            each: function ()
            {
            }
          },
        errorCode: ErrorCodes.ERR_STMT_FETCH_ROWS_MISSING_END
      },
      {
        name: 'fetchRows() undefined end()',
        options:
          {
            each: function ()
            {
            },
            end: undefined
          },
        errorCode: ErrorCodes.ERR_STMT_FETCH_ROWS_MISSING_END
      },
      {
        name: 'fetchRows() null end()',
        options:
          {
            each: function ()
            {
            },
            end: null
          },
        errorCode: ErrorCodes.ERR_STMT_FETCH_ROWS_MISSING_END
      },
      {
        name: 'fetchRows() invalid end()',
        options:
          {
            each: function ()
            {
            },
            end: ''
          },
        errorCode: ErrorCodes.ERR_STMT_FETCH_ROWS_INVALID_END
      }
    ];

  var index, length, testCase, error;
  for (index = 0, length = testCases.length; index < length; index++)
  {
    testCase = testCases[index];

    error = null;

    try
    {
      statement.fetchRows(testCase.options);
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
  }
}
