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
});
