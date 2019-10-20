/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
var snowflake = require('./../../lib/snowflake');
var Core = require('./../../lib/core');
var assert = require('assert');
var async = require('async');
var connectionOptions = require('./connectionOptions');
const Errors = require('./../../lib/errors');
const ErrorCodes = Errors.codes;
var Util = require('./../../lib/util');

describe('Statement Tests', function ()
{
  var connection = snowflake.createConnection(connectionOptions.valid);
  var sqlText = 'select 1 as "c1";';
  it('with a valid token', function (done)
    {

      const coreInst = Core({
        qaMode: true,
        httpClientClass: require('./../../lib/http/node'),
        loggerClass: require('./../../lib/logger/node'),
        client:
          {
            version: Util.driverVersion,
            environment: process.versions
          }
      });

      const tokenConn = coreInst.createConnection(connectionOptions.valid);
      let goodConnection;
      async.series(
        [
          function (callback)
          {
            tokenConn.connect(function (err, conn)
            {
              assert.ok(!err, 'there should be no error');
              const sessionToken = tokenConn.getTokens().sessionToken;
              assert.ok(sessionToken);
              goodConnection = snowflake.createConnection(Object.assign({}, connectionOptions.valid, {
                username: undefined, password: undefined, sessionToken
              }));

              callback();
            });
          }
          ,
          function (callback)
          {
            statement = goodConnection.execute(
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

                  callback();
                }
              });

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
            assert.ok(goodConnection.isUp(), "not active");
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
                  assert.strictEqual(rows[0].getColumnValue('c1'), 1,
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
    }
  )
  ;

  it('with an invalid token', function (done)
  {
    const badConnection = snowflake.createConnection(Object.assign({}, connectionOptions.valid, {
      username: undefined, password: undefined, sessionToken: 'invalid token'
    }));
    async.series(
      [
        function (callback)
        {
          statement = badConnection.execute(
            {
              sqlText: sqlText,
              complete: function (err, stmt)
              {
                assert.ok(err != undefined, 'expect an error');
                assert.ok(err.code === ErrorCodes.ERR_SF_RESPONSE_INVALID_TOKEN, 'Should throw invalid token error')
                callback();
              }
            });

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
          assert.ok(badConnection.isUp(), "not active");
          callback();
        },
      ],
      function ()
      {
        done();
      });
  });

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

                callback();
              }
            });

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
                assert.strictEqual(rows[0].getColumnValue('c1'), 1,
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