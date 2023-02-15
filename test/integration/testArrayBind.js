/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
var async = require('async');
var assert = require('assert');
var testUtil = require('./testUtil');

const sourceRowCount = 30000;

describe('Test Concurrent Execution', function ()
{
  var connection;
  var createABTable = 'create or replace table testAB(colA string, colB number, colC date, colD time, colE TIMESTAMP_NTZ, colF TIMESTAMP_TZ)';
  var insertAB = 'insert into testAB values(?, ?, ?, ?, ?, ?)';
  var selectAB = 'select * from testAB where colB = 1';
  var createNABTable = 'create or replace table testNAB(colA string, colB number, colC date, colD time, colE TIMESTAMP_NTZ, colF TIMESTAMP_TZ)';
  var insertNAB = 'insert into testNAB values(?, ?, ?, ?, ?, ?)';
  var selectNAB = 'select * from testNAB where colB = 1';

  before(function (done)
  {
    connection = testUtil.createConnection();
    testUtil.connect(connection, function ()
    {
      connection.execute({
        sqlText: createABTable,
        complete: function (err)
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

  it('testArrayBind', function (done)
  {
    var NABData;
    async.series(
      [
        function(callback)
        {
          var arrBind = [];
          var count = 100000;
          for(var i = 0; i<count; i++)
          {
            arrBind.push(['string'+i, i, "2020-05-11", "12:35:41.3333333", "2022-04-01 23:59:59", "2022-07-08 12:05:30.9999999"]);
          }
          
          var insertABStmt = connection.execute({
            sqlText: insertAB,
            binds: arrBind,
            complete: function (err, stmt) {
              testUtil.checkError(err);
              assert.strictEqual(stmt.getNumUpdatedRows(), count);
              callback();
            }
          });
        },
        function(callback)
        {
          var createNAB = connection.execute({
            sqlText: createNABTable,
            complete: function (err, stmt) {
              testUtil.checkError(err);
              callback();
            }
          });
        },
        function(callback)
        {
          var arrBind = [];
          var count = 10;
          for(var i = 0; i<count; i++)
          {
            arrBind.push(['string'+i, i, "2020-05-11", "12:35:41.3333333", "2022-04-01 23:59:59", "2022-07-08 12:05:30.9999999"]);
          }
          var insertNABStmt = connection.execute({
            sqlText: insertNAB,
            binds: arrBind,
            complete: function (err, stmt) {
              testUtil.checkError(err);
              assert.strictEqual(stmt.getNumUpdatedRows(), count);
              callback();
            }
          });
        },
        function(callback)
        {
          var selectNABTable = connection.execute({
            sqlText: selectNAB,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              NABData = rows[0];
              callback();
            }
          });
        },
        function (callback) 
        {
          var selectABTable = connection.execute({
            sqlText: selectAB,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              var ABData = rows[0];
              assert.ok(ABData['COLA'] == NABData['COLA']);
              assert.ok(ABData['COLB'] == NABData['COLB']);
              assert.ok(ABData['COLC'] == '2020-05-11T00:00:00Z');
              assert.ok(NABData['COLC'] == '2020-05-11T00:00:00Z');

              assert.ok(ABData['COLC'] == NABData['COLC']);
              assert.ok(ABData['COLD'] == NABData['COLD']);
              assert.ok(ABData['COLE'] == NABData['COLE']);
              assert.ok(ABData['COLF'] == NABData['COLF']);
              callback();
            }
          });
        },
      ],
      done
    );
  });
});
