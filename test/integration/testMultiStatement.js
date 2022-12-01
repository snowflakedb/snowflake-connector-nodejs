/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
var async = require('async');
var assert = require('assert');
var testUtil = require('./testUtil');


describe('Test multi statement', function ()
{
  var connection;
  var selectTable = 'select ?; select ?,3; select ?,5,6';

  before(function (done)
  {
	var bindArr = [1,2,4];
	var count=0;
	
    connection = testUtil.createConnection();
    testUtil.connect(connection, function ()
    {
      connection.execute({
        sqlText: createTable,
		binds: bindArr,
        complete: function (err, stmt)
        {
          	testUtil.checkError(err);
		  	var stream = stmt.streamRows();
			stream.on('error', function (err) {
				testUtil.checkError(err);
			});
			stream.on('data', function (row) {
				count += Object.values(row).length;
				if (stmt.hasNext()) {
					console.log('==== hasNext');
					stmt.NextResult();
				}
				else
				{
					console.log('==== close connection');
					assert.strictEqual(6, count);
					CloseConnection();
				}
			});
        }
      });
    });
  });

  after(function (done)
  {
    testUtil.destroyConnection(connection, done);
  });
});
