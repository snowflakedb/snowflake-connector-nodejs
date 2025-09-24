const async = require('async');
const assert = require('assert');
const testUtil = require('./testUtil');
const Util = require('./../../lib/util');
const Logger = require('../../lib/logger');

describe('Test multi statement', function () {
  let connection;
  const alterSessionMultiStatement0 = 'alter session set MULTI_STATEMENT_COUNT=0';
  const selectTable = 'select ?; select ?,3; select ?,5,6';
  const multiSelectTable = 'select 1; select 2,3; select 4,5,6';

  before(function (done) {
    connection = testUtil.createConnection();
    testUtil.connect(connection, function () {
      connection.execute({
        sqlText: alterSessionMultiStatement0,
        complete: function (err) {
          testUtil.checkError(err);
          done();
        },
      });
    });
  });

  after(function (done) {
    testUtil.destroyConnection(connection, done);
  });

  it('testMultiStatement', function (done) {
    async.series(
      [
        function (callback) {
          connection.execute({
            sqlText: 'select current_version()',
            complete: function (err, stmt, rows) {
              Logger.getInstance().info('=== driver version = ' + Util.driverVersion);
              Logger.getInstance().info('=== server version =');
              Logger.getInstance().info(rows);
              callback();
            },
          });
        },
        function () {
          const bindArr = [1, 2, 4];
          let count = 0;
          connection.execute({
            sqlText: selectTable,
            binds: bindArr,
            complete: function (err, stmt) {
              testUtil.checkError(err);
              const stream = stmt.streamRows();
              stream.on('error', function (err) {
                testUtil.checkError(err);
              });
              stream.on('data', function (row) {
                Logger.getInstance().info(row);
                count += Object.values(row).length;
                if (stmt.hasNext()) {
                  Logger.getInstance().info('==== hasNext');
                  stmt.NextResult();
                } else {
                  Logger.getInstance().info('==== close connection');
                  assert.strictEqual(6, count);
                  done();
                }
              });
            },
          });
        },
      ],
      done,
    );
  });

  it('test each statement in multi statement', function (done) {
    let count = 0;
    const queryLists = multiSelectTable.split(';');
    connection.execute({
      sqlText: multiSelectTable,
      complete: function (err, stmt) {
        testUtil.checkError(err);
        assert.strictEqual(queryLists[count], stmt.getSqlText());
        if ('hasNext' in stmt && stmt.hasNext()) {
          count++;
          stmt.NextResult();
        } else {
          done();
        }
      },
    });
  });
});
