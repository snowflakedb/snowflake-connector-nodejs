/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
var async = require('async');
var assert = require('assert');
var fs = require('fs');
var os = require('os');
var path = require('path');
var testUtil = require('./testUtil');
const connOption = require('./connectionOptions');

const DATABASE_NAME = connOption.valid.database;
const SCHEMA_NAME = connOption.valid.schema;
const WAREHOUSE_NAME = connOption.valid.warehouse;

var connection;
var files = new Array();

function uploadFiles(callback, index = 0)
{
  if(index < files.length)
  {
    var putQuery = `PUT file://${files[index]} @${DATABASE_NAME}.${SCHEMA_NAME}.%TESTTBL`;
    var insertStmt = connection.execute({
      sqlText: putQuery,
      complete: function (err, stmt) {
        testUtil.checkError(err);
        if(!err)
        {
          index++;
          if(index < files.length)
          {
              uploadFiles(callback, index);
          }
          else
          {
            callback();
          }
        }
      }
    });
  }
}

describe('Test Put Small Files', function ()
{
  this.timeout(100000);
  var useWH = `use warehouse ${WAREHOUSE_NAME}`;
  var createTable = `create or replace table ${DATABASE_NAME}.${SCHEMA_NAME}.TESTTBL(colA string, colB number, colC date, colD time, colE TIMESTAMP_NTZ, colF TIMESTAMP_TZ)`;
  var copytInto = `copy into ${DATABASE_NAME}.${SCHEMA_NAME}.TESTTBL`;
  var select1row = `select * from ${DATABASE_NAME}.${SCHEMA_NAME}.TESTTBL where colB = 3`;
  var selectAll = `select count(*) AS NUM from ${DATABASE_NAME}.${SCHEMA_NAME}.TESTTBL`;
  var count = 5000;

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

  it('testPutSmallFiles', function (done)
  {
    async.series(
      [
        function(callback)
        {
          var createTableStmt = connection.execute({
            sqlText: createTable,
            complete: function (err, stmt) {
              testUtil.checkError(err);
              callback();
            }
          });
        },
        function(callback)
        {
          var arrBind = [];
          var filesize = 1024 * 100;
          
          for(var i = 0; i<count; i++)
          {
            arrBind.push(['string'+i, i, "2020-05-11", "12:35:41.3333333", "2022-04-01 23:59:59", "2022-07-08 12:05:30.9999999"]);
          }
          
          var fileCount = 0;
          var strbuffer = "";
          
          var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tmp'));
          if (tmpDir.indexOf('~') != -1 && process.platform === "win32") {
            var tmpFolderName = tmpDir.substring(tmpDir.lastIndexOf('\\'));
            tmpDir = process.env.USERPROFILE + '\\AppData\\Local\\Temp\\' + tmpFolderName;
          }
          for(var i=0; i<arrBind.length; i++)
          {
            for(var j=0; j<arrBind[i].length; j++)
            {
              if(j>0)
                strbuffer += ',';
                strbuffer += arrBind[i][j];
            }
            strbuffer += '\n';

            if((strbuffer.length >= filesize) || (i == arrBind.length-1))
            {
              var fileName = path.join(tmpDir, (++fileCount).toString());
              fs.writeFileSync(fileName, strbuffer);
              files.push(fileName);
              strbuffer = "";
            }
          }
          var callbackfunc = function()
          {
            for(var fileName in files)
            {
              if(fs.existsSync(fileName))
              {
                fs.unlinkSync(fileName);
              }
            }
            callback();
          }
          uploadFiles(callbackfunc,0);
        },
        function copy(callback)
        {
          var copyintostmt = connection.execute({
            sqlText: copytInto,
            complete: function (err, stmt) {
              testUtil.checkError(err);
              callback();
            }
          });
        },
        function select(callback)
        {
          var selectstmt = connection.execute({
            sqlText: select1row,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              assert.strictEqual(rows[0]['COLA'], 'string3');
              var dateValue = new Date(rows[0]['COLC']).getTime();
              var timeValue = new Date(rows[0]['COLE']).getTime();
              assert.strictEqual(dateValue.toString(), '1589155200000');
              assert.strictEqual(timeValue.toString(), '1648857599000');
              callback();
            }
          });
        },
        function selectall(callback)
        {
          var selectstmt = connection.execute({
            sqlText: selectAll,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              assert.strictEqual(rows[0]['NUM'], count);
              callback();
            }
          });
        },
      ],
      done
    );
  });
});
