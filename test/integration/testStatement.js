const snowflake = require('./../../lib/snowflake');
const Core = require('./../../lib/core');
const assert = require('assert');
const async = require('async');
const connectionOptions = require('./connectionOptions');
const Errors = require('./../../lib/errors');
const ErrorCodes = Errors.codes;
const Util = require('./../../lib/util');
const testUtil = require('./testUtil');

describe('Statement Tests', function () {
  let connection;
  const sqlText = 'select 1 as "c1";';

  beforeEach(() => {
    connection = snowflake.createConnection(connectionOptions.valid);
  });

  it('with a valid token', function (done) {

    const coreInst = Core({
      qaMode: true,
      httpClientClass: require('./../../lib/http/node').NodeHttpClient,
      loggerClass: require('./../../lib/logger/node'),
      client:
          {
            version: Util.driverVersion,
            environment: process.versions
          }
    });

    const tokenConn = coreInst.createConnection(connectionOptions.valid);
    let goodConnection;
    let statement;
    async.series(
      [
        function (callback) {
          tokenConn.connect(function (err) {
            assert.ok(!err, 'there should be no error');
            const sessionToken = tokenConn.getTokens().sessionToken;
            assert.ok(sessionToken);
            goodConnection = snowflake.createConnection(Object.assign({}, connectionOptions.valid, {
              username: undefined, password: undefined, sessionToken
            }));

            callback();
          });
        },
        function (callback) {
          statement = goodConnection.execute(
            {
              sqlText: sqlText,
              complete: function (err, stmt) {
                assert.ok(!err, 'there should be no error');
                assert.strictEqual(stmt, statement,
                  'the execute() callback should be invoked with the statement');

                // we should only have one column c1
                const columns = statement.getColumns();
                assert.ok(columns);
                assert.strictEqual(columns.length, 1);
                assert.ok(columns[0]);
                assert.strictEqual(columns[0].getName(), 'c1');

                assert.strictEqual(statement.getNumRows(), 1);
                assert.ok(statement.getSessionState());
                assert.ok(statement.getStatementId());
                assert.ok(statement.getQueryId());

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
          assert.strictEqual(statement.getQueryId(), undefined);
            
        },
        function (callback) {
          assert.ok(goodConnection.isUp(), 'not active');
          callback();
        },
        function (callback) {
          const rows = [];
          statement.fetchRows(
            {
              each: function (row) {
                rows.push(row);
              },
              end: function (err, stmt) {
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
      function () {
        done();
      });
  }
  );

  it('with an invalid token', function (done) {
    const badConnection = snowflake.createConnection(Object.assign({}, connectionOptions.valid, {
      username: undefined, password: undefined, sessionToken: 'invalid token'
    }));
    let statement;
    async.series(
      [
        function (callback) {
          statement = badConnection.execute(
            {
              sqlText: sqlText,
              complete: function (err) {
                assert.ok(err !== undefined, 'expect an error');
                assert.ok(err.code === ErrorCodes.ERR_SF_RESPONSE_INVALID_TOKEN, 'Should throw invalid token error');
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
          assert.strictEqual(statement.getQueryId(), undefined);
        },
        function (callback) {
          assert.ok(badConnection.isUp(), 'not active');
          callback();
        },
      ],
      function () {
        done();
      });
  });

  it('statement api', function (done) {
    let statement;

    async.series(
      [
        function (callback) {
          connection.connect(function (err, conn) {
            assert.ok(!err, 'there should be no error');
            assert.strictEqual(conn, connection,
              'the connect() callback should be invoked with the statement');

            callback();
          });
        },
        function (callback) {
          statement = connection.execute(
            {
              sqlText: sqlText,
              complete: function (err, stmt) {
                assert.ok(!err, 'there should be no error');
                assert.strictEqual(stmt, statement,
                  'the execute() callback should be invoked with the statement');

                // we should only have one column c1
                const columns = statement.getColumns();
                assert.ok(columns);
                assert.strictEqual(columns.length, 1);
                assert.ok(columns[0]);
                assert.strictEqual(columns[0].getName(), 'c1');

                assert.strictEqual(statement.getNumRows(), 1);
                assert.ok(statement.getSessionState());
                assert.ok(statement.getStatementId());
                assert.ok(statement.getQueryId());

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
          assert.strictEqual(statement.getQueryId(), undefined);
        },
        function (callback) {
          assert.ok(connection.isUp(), 'not active');
          callback();
        },
        function (callback) {
          const rows = [];
          statement.fetchRows(
            {
              each: function (row) {
                rows.push(row);
              },
              end: function (err, stmt) {
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
      function () {
        done();
      });
  });
});

describe('Call Statement', function () {
  let connection;

  beforeEach(async () => {
    connection = snowflake.createConnection(connectionOptions.valid);
    await testUtil.connectAsync(connection);
  });

  it('call statement', function (done) {
    async.series(
      [
        function (callback) {
          const statement = connection.execute({
            sqlText: 'ALTER SESSION SET USE_STATEMENT_TYPE_CALL_FOR_STORED_PROC_CALLS=true;',
            complete: function () {
              const stream = statement.streamRows();
              stream.on('error', function (err) {
                // Expected error - SqlState: 22023, VendorCode: 1006
                assert.strictEqual('22023', err.sqlState);
                callback();
              });
              stream.on('data', function (row) {
                assert.strictEqual(true, row.status.includes('success'));
                callback();
              });
            }
          });
        },
        function (callback) {
          const statement = connection.execute({
            sqlText: 'create or replace procedure\n'
              + 'TEST_SP_CALL_STMT_ENABLED(in1 float, in2 variant)\n'
              + 'returns string language javascript as $$\n'
              + 'let res = snowflake.execute({sqlText: \'select ? c1, ? c2\', binds:[IN1, JSON.stringify(IN2)]});\n'
              + 'res.next();\n'
              + 'return res.getColumnValueAsString(1) + \' \' + res.getColumnValueAsString(2) + \' \' + IN2;\n'
              + '$$;',
            complete: function () {
              const stream = statement.streamRows();
              stream.on('error', function (err) {
                done(err);
              });
              stream.on('data', function (row) {
                assert.strictEqual(true, row.status.includes('success'));
              });
              stream.on('end', function () {
                callback();
              });
            }
          });
        },
        function (callback) {
          const statement = connection.execute({
            sqlText: 'call TEST_SP_CALL_STMT_ENABLED(?, to_variant(?))',
            binds: [1, '[2,3]'],
            complete: function () {
              const stream = statement.streamRows();
              stream.on('error', function (err) {
                done(err);
              });
              stream.on('data', function (row) {
                const result = '1 "[2,3]" [2,3]';
                assert.strictEqual(result, row.TEST_SP_CALL_STMT_ENABLED);
              });
              stream.on('end', function () {
                callback();
              });
            }
          });
        },
        function (callback) {
          const statement = connection.execute({
            sqlText: 'drop procedure if exists TEST_SP_CALL_STMT_ENABLED(float, variant)',
            complete: function () {
              const stream = statement.streamRows();
              stream.on('error', function (err) {
                done(err);
              });
              stream.on('data', function (row) {
                assert.strictEqual(true, row.status.includes('success'));
              });
              stream.on('end', function () {
                callback();
              });
            }
          });
        }
      ],
      function () {
        done();
      });
  });
});
