/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
const snowflake = require('./../../lib/snowflake');
var async = require('async');
var assert = require('assert');
var testUtil = require('./testUtil');
var connOption = require('./connectionOptions');
const { error } = require('winston');

const DATABASE_NAME = connOption.valid.database;
const SCHEMA_NAME = connOption.valid.schema;
const WAREHOUSE_NAME = connOption.valid.warehouse;

describe('Test Array Bind', function ()
{
  this.timeout(300000);
  var connection;
  var createABTable = `create or replace table  ${DATABASE_NAME}.${SCHEMA_NAME}.testAB(colA string, colB number, colC date, colD time, colE TIMESTAMP_NTZ, colF TIMESTAMP_TZ)`;
  var insertAB = `insert into  ${DATABASE_NAME}.${SCHEMA_NAME}.testAB values(?, ?, ?, ?, ?, ?)`;
  var selectAB = `select * from testAB where colB = 1`;
  var createNABTable = `create or replace table  ${DATABASE_NAME}.${SCHEMA_NAME}.testNAB(colA string, colB number, colC date, colD time, colE TIMESTAMP_NTZ, colF TIMESTAMP_TZ)`;
  var insertNAB = `insert into  ${DATABASE_NAME}.${SCHEMA_NAME}.testNAB values(?, ?, ?, ?, ?, ?)`;
  var selectNAB = `select * from  ${DATABASE_NAME}.${SCHEMA_NAME}.testNAB where colB = 1`;
  var useWH = `use warehouse ${WAREHOUSE_NAME}`;
  var createNullTable = `create or replace table  ${DATABASE_NAME}.${SCHEMA_NAME}.testNullTB(colA string, colB number, colC date, colD time, colE TIMESTAMP_NTZ, colF TIMESTAMP_TZ)`;
  var insertNull = `insert into  ${DATABASE_NAME}.${SCHEMA_NAME}.testNullTB values(?, ?, ?, ?, ?, ?)`;
  var selectNull = `select * from testNullTB where colB = 1`;

  before(function (done)
  {
    connOption.valid.arrayBindingThreshold = 3;
    connection = snowflake.createConnection(connOption.valid);
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
          var count = 100;
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
          var count = 2;
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

  it('testArrayBindWillNull', function (done)
  {
    var NABData;
    async.series(
      [
        function(callback)
        {
          var createNAB = connection.execute({
            sqlText: createNullTable,
            complete: function (err, stmt) {
              testUtil.checkError(err);
              callback();
            }
          });
        },
        function(callback)
        {
          var arrBind = [];
          var count = 100;
          for(var i = 0; i<count; i++)
          {
            arrBind.push([null, i, "2020-05-11", "12:35:41.3333333", "2022-04-01 23:59:59", "2022-07-08 12:05:30.9999999"]);
          }
          
          var insertABStmt = connection.execute({
            sqlText: insertNull,
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
          var count = 2;
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
            sqlText: selectNull,
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

              assert.equal(ABData['COLA'], "");
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
          var count = 100;
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
                done(err);
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
  it('testBindWithLargeArray', function (done)
  {
    async.series(
      [
        function (callback)
        {
          var createSql = 'create or replace table testBindLargeArray(colA varchar(30))';
          testUtil.executeCmd(connection, createSql, callback);
        },
        function (callback)
        {
          var arrBind = [];
          var count = 100;
          for(var i = 0; i<count; i++)
          {
            arrBind.push(["some-data-for-stuff1"]);
          }
          var insertSql = 'insert into testBindLargeArray(colA) values (?)';
          var insertStatement = connection.execute({
            sqlText: insertSql,
            binds: arrBind,
            complete: function (err, stmt) {
              if (err) {
                console.error('1 Failed to execute statement due to the following error: ' + err.message);
                done(err);
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
  it('testBindWithArray', function (done)
  {
    async.series(
      [
        function (callback)
        {
          var createSql = 'create or replace table test101 (id INT, type VARCHAR(40), data VARIANT, createdDateTime TIMESTAMP_TZ(0), action VARCHAR(256))';
          testUtil.executeCmd(connection, createSql, callback);
        },
        function (callback)
        {
          const dataset = [
            [
              "5489",
              "SAMPLE",
              "{\"user\":{\"SSS\":\"KKKK003\",\"email\":\"THE\"}",
              "2018-11-02T04:14:56.000000Z",
              null
            ],
            [
              "5490",
              "SAMPLE",
              "{\"user\":{\"SSS\":\"LLL108\",\"email\":\"Jenn\"}",
              "2018-11-02T04:14:56.000000Z",
              null
            ],
            [
              "5491",
              "SAMPLE",
              "{\"user\":{\"SSS\":\"LLL108\",\"email\":\"Jennif\"}",
              "2018-11-02T04:14:56.000000Z",
              null
            ],
            [
              "5492",
              "SAMPLE",
              "{\"user\":{\"SSS\":\"LLL108\",\"email\":\"Je\"}",
              "2018-11-02T04:14:56.000000Z",
              null
            ],
            [
              "5493",
              "SAMPLE",
              "{\"user\":{\"SSS\":\"LLL108\",\"email\":\"Jenn\"}",
              "2018-11-02T04:14:56.000000Z",
              null
            ],
            [
              "5494",
              "SAMPLE",
              "{\"user\":{\"SSS\":\"LLL108\",\"email\":\"Jennifer@xxx.com\"}",
              "2018-11-02T04:14:56.000000Z",
              null
            ]
          ];
          
          var flatValue = [];
          dataset.forEach(element =>{element.forEach(value => {flatValue.push(value)})});
          var insertTable101 = 'insert into test101 (id,type,data,createdDateTime,action) select COLUMN1,COLUMN2,TRY_PARSE_JSON(COLUMN3),COLUMN4,COLUMN5 from values  (?,?,?,?,?),(?,?,?,?,?),(?,?,?,?,?),(?,?,?,?,?),(?,?,?,?,?),(?,?,?,?,?)';
          var insertStatement = connection.execute({
            sqlText: insertTable101,
            binds: flatValue,
            fetchAsString: ['Number', 'Date', 'JSON'],
            complete: function (err, stmt) {
              if (err) {
                console.error('1 Failed to execute statement due to the following error: ' + err.message);
                done(err);
              }
              else {
                console.log('inserted rows=' + stmt.getNumUpdatedRows());
                callback();
              }
            }
          });
        },
        function (callback)
        {
          var selectSql = 'select * from test101 where ID = 5489';
          var selectABTable = connection.execute({
            sqlText: selectSql,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              var result = rows[0];
              assert.equal(result['TYPE'], "SAMPLE");
              done();
            }
          });
        },
      ],
      done
    );
  });
});

describe('testArrayBind - full path', function ()
{
  this.timeout(600000);
  var connection;
  var createABTable = `create or replace table  ${DATABASE_NAME}.${SCHEMA_NAME}.testAB(colA string, colB number, colC date, colD time, colE TIMESTAMP_NTZ, colF TIMESTAMP_TZ)`;
  var insertAB = `insert into  ${DATABASE_NAME}.${SCHEMA_NAME}.testAB values(?, ?, ?, ?, ?, ?)`;

  before(function (done)
  {
      connection = snowflake.createConnection({
      accessUrl: connOption.valid.accessUrl,
      account: connOption.valid.account,
      username: connOption.valid.username,
      password: connOption.valid.password,
      warehouse: connOption.valid.warehouse,
      role: connOption.valid.role,
      arrayBindingThreshold: 3
    });
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

  it('Full path array bind', function ()
  {
    var arrBind = [];
    var count = 100;
    for(var i = 0; i<count; i++)
    {
      arrBind.push([null, i, "2020-05-11", "12:35:41.3333333", "2022-04-01 23:59:59", "2022-07-08 12:05:30.9999999"]);
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
  });
  after(function (done)
  {
    testUtil.destroyConnection(connection, done);
  });

});
