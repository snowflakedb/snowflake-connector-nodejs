/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
var async = require('async');
var assert = require('assert');
var testUtil = require('./testUtil');
const connOption = require('./connectionOptions');

const DATABASE_NAME = connOption.valid.database;
const SCHEMA_NAME = connOption.valid.schema;
const WAREHOUSE_NAME = connOption.valid.warehouse;

describe('Test Array Bind', function ()
{
  this.timeout(200000);
  var connection;
  var createABTable = `create or replace table  ${DATABASE_NAME}.${SCHEMA_NAME}.testAB(colA string, colB number, colC date, colD time, colE TIMESTAMP_NTZ, colF TIMESTAMP_TZ)`;
  var insertAB = `insert into  ${DATABASE_NAME}.${SCHEMA_NAME}.testAB values(?, ?, ?, ?, ?, ?)`;
  var selectAB = `select * from testAB where colB = 1`;
  var createNABTable = `create or replace table  ${DATABASE_NAME}.${SCHEMA_NAME}.testNAB(colA string, colB number, colC date, colD time, colE TIMESTAMP_NTZ, colF TIMESTAMP_TZ)`;
  var insertNAB = `insert into  ${DATABASE_NAME}.${SCHEMA_NAME}.testNAB values(?, ?, ?, ?, ?, ?)`;
  var selectNAB = `select * from  ${DATABASE_NAME}.${SCHEMA_NAME}.testNAB where colB = 1`;
  var useWH = `use warehouse ${WAREHOUSE_NAME}`;

  before(function (done)
  {
    connection = testUtil.createConnection();
    testUtil.connect(connection, function ()
    {
      connection.execute({
        sqlText: useWH,
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
          var createNAB = connection.execute({
            sqlText: createABTable,
            complete: function (err, stmt) {
              testUtil.checkError(err);
              callback();
            }
          });
        },
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

              var ABDate = new Date(ABData['COLC']);
              var ABDataD = new Date(ABData['COLD']).getTime();
              var ABDataE = new Date(ABData['COLE']).getTime();
              var ABDataF = new Date(ABData['COLF']).getTime();
              var NABDate = new Date(NABData['COLC']);
              var NABDataD = new Date(NABData['COLD']).getTime();
              var NABDataE = new Date(NABData['COLE']).getTime();
              var NABDataF = new Date(NABData['COLF']).getTime();

              assert.equal(ABData['COLA'], NABData['COLA']);
              assert.equal(ABData['COLB'], NABData['COLB']);
              assert.equal(ABDate.toString(), NABDate.toString());
              assert.equal(ABDataD.toString(), NABDataD.toString());
              assert.equal(ABDataE.toString(), NABDataE.toString());
              assert.equal(ABDataF.toString(), NABDataF.toString());
              callback();
            }
          });
        },
      ],
      done
    );
  });
  
  it('testBindWithJson', function (done)
  {
    async.series(
      [
        function (callback)
        {
          var createSql = 'create or replace table testBindJson(colA varchar(30), colB varchar(30))';
          testUtil.executeCmd(connection, createSql, callback);
        },
        function (callback)
        {
          var arrBind = [];
          var count = 15000;
          for(var i = 0; i<count; i++)
          {
            arrBind.push(["some-data-for-stuff1","some-data-for-stuff2"]);
          }
          var insertSql = 'insert into testBindJson(cola,colb) select value:stuff1, value:stuff2 from table(flatten(parse_json(?)))';
          var insertStatement = connection.execute({
            sqlText: insertSql,
            binds: [JSON.stringify(arrBind)],
            complete: function (err, stmt) {
              if (err) {
                console.error('1 Failed to execute statement due to the following error: ' + err.message);
              }
              else {
                console.log('inserted rows=' + stmt.getNumUpdatedRows());
                assert.strictEqual(stmt.getNumUpdatedRows(), count);
                done();
              }
            }
          });
        },
      ],
      done
    );
  });
});
