/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
var async = require('async');
var assert = require('assert');
var testUtil = require('./testUtil');
var Util = require('./../../lib/util');


describe('Test multi statement', function ()
{
  var connection;
  var alterSessionMultiStatement0 = "alter session set MULTI_STATEMENT_COUNT=0";
  var selectTable = 'select ?; select ?,3; select ?,5,6';

  before(function (done)
  {
    connection = testUtil.createConnection();
    testUtil.connect(connection, function ()
    {
      connection.execute({
        sqlText: alterSessionMultiStatement0,
        complete: function (err, stmt)
        {
          testUtil.checkError(err);
          done();
        }
      });
    });
  });

  after(function (done)
  {
    testUtil.destroyConnection(connection, done);
  });

    it('testMultiStatement', function (done) {
        async.series(
            [
                function (callback) {
                    connection.execute({
                        sqlText: 'select current_version()',
                        complete: function (err, stmt, rows) {
                            console.log('=== driver version = ' + Util.driverVersion);
                            console.log('=== server version =');
                            console.log(rows);
                            callback();
                        }
                    });
                },
                function (callback) {
                    var bindArr = [1, 2, 4];
                    var count = 0;
                    connection.execute({
                        sqlText: selectTable,
                        binds: bindArr,
                        complete: function (err, stmt) {
                            testUtil.checkError(err);
                            var stream = stmt.streamRows();
                            stream.on('error', function (err) {
                                testUtil.checkError(err);
                            });
                            stream.on('data', function (row) {
                                console.log(row);
                                count += Object.values(row).length;
                                if (stmt.hasNext()) {
                                    console.log('==== hasNext');
                                    stmt.NextResult();
                                }
                                else {
                                    console.log('==== close connection');
                                    assert.strictEqual(6, count);
                                    done();
                                }
                            });
                        }
                    });
                }
            ],
            done
        );
  });
});