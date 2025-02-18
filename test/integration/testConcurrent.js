const async = require('async');
const assert = require('assert');
const testUtil = require('./testUtil');

const sourceRowCount = 30000;

describe('Test Concurrent Execution', function () {
  let connection;
  const selectOrders = 'select true from table(generator(rowcount=>' + sourceRowCount + '))';
  const disableCacheResult = 'alter session set use_cached_result = false';

  before(function (done) {
    connection = testUtil.createConnection();
    testUtil.connect(connection, function () {
      connection.execute({
        sqlText: disableCacheResult,
        complete: function (err) {
          testUtil.checkError(err);
          done();
        }
      });
    });
  });

  after(function (done) {
    testUtil.destroyConnection(connection, done);
  });

  it('testConcurrentSelectBySameUser', function (done) {
    let completedQueries = 0;
    const numberOfQueries = 10;
    for (let i = 0; i < numberOfQueries; i++) {
      connection.execute({
        sqlText: selectOrders,
        complete: function (err, stmt) {
          testUtil.checkError(err);
          const stream = stmt.streamRows();
          let rowCount = 0;
          stream.on('readable', function () {
            while (stream.read() !== null) {
              rowCount++;
            }
          });
          stream.on('error', function (err) {
            testUtil.checkError(err);
          });
          stream.on('end', function () {
            assert.strictEqual(rowCount, sourceRowCount);
            completedQueries++;
            if (completedQueries === numberOfQueries) {
              done();
            }
          });
        }
      });
    }
  });

  it('testConcurrentCreateTable', function (done) {
    async.series(
      [
        function (callback) {
          const numberOfThread = 10;
          let completedThread = 0;
          for (let i = 0; i < numberOfThread; i++) {
            testUtil.executeCmd(
              connection,
              'create or replace table test' + i + '(colA varchar)',
              function () {
                completedThread++;
                if (completedThread === numberOfThread) {
                  callback();
                }
              }
            );
          }
        },
        function (callback) {
          const numberOfThread = 10;
          let completedThread = 0;
          for (let i = 0; i < numberOfThread; i++) {
            testUtil.executeCmd(
              connection,
              'drop table if exists test' + i,
              function () {
                completedThread++;
                if (completedThread === numberOfThread) {
                  callback();
                }
              }
            );
          }
        }
      ],
      done
    );
  });

  it('testConcurrentSelectFromDifferentSession', function (done) {
    const numberOfQueries = 10;
    let completedQueries = 0;
    for (let i = 0; i < numberOfQueries; i++) {
      testUtil.createConnection()
        .connect(function (err, conn) {
          conn.execute({
            sqlText: selectOrders,
            complete: function (err, stmt) {
              const stream = stmt.streamRows();
              let rowCount = 0;
              stream.on('readable', function () {
                while (stream.read() !== null) {
                  rowCount++;
                }
              });
              stream.on('error', function (err) {
                testUtil.checkError(err);
              });
              stream.on('end', function () {
                assert.strictEqual(rowCount, sourceRowCount);
                completedQueries++;
                if (completedQueries === numberOfQueries) {
                  done();
                }
              });
            }
          });
        });
    }
  });
});
