/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
var async = require('async');
var assert = require('assert');
var testUtil = require('./testUtil');

const sourceRowCount = 30000;

describe('Test Concurrent Execution', function ()
{
  this.timeout(1000000);
  
  var connection;
  var createTable = 'create or replace table testTbl(colA string, colB number, colC date, colD time, colE TIMESTAMP_NTZ, colF TIMESTAMP_TZ)';
  var insertWithQmark = 'insert into testTbl values(?, ?, ?, ?, ?, ?)';

  before(function (done)
  {
    connection = testUtil.createConnection();
    testUtil.connect(connection, function ()
    {
      connection.execute({
        sqlText: createTable,
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
	var arrBind = [];
	var count = 20000;
	for(var i = 0; i<count; i++)
	{
		arrBind.push(['string'+i, i, "2020-05-11", "12:35:41.3333333", "2022-04-01 23:59:59", "2022-07-08 12:05:30.9999999"]);
	}
	
	var insertStatement = connection.execute({
		sqlText: insertWithQmark,
		binds: arrBind,
		complete: function (err, stmt) {
			testUtil.checkError(err);
			assert.strictEqual(stmt.getNumUpdatedRows(), count);
            done();
		}
	});
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
