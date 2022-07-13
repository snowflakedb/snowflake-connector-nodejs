'use strict'

var snowflake = require('snowflake-sdk');
snowflake.configure({logLevel : 'trace'});

var connection = snowflake.createConnection({
	account: "simbapartner",
	username: "SEN",
	password: "NewPwd4SEN!",
	database: "TESTDB",
	SCHEMA: "SEN",
	warehouse: "SIMBA_WH_TEST",
	forcestreamput: true
}
);

var useSchema = 'use schema SEN';
var createTestTbl = 'create or replace table testTbl(colA string, colB number, colC date, colD time, colE TIMESTAMP_NTZ, colF TIMESTAMP_TZ)';
var dropTestTbl = 'drop table if exists testTbl';
var insertWithQmark = 'insert into testTbl values(?, ?, ?, ?, ?, ?)';

var connection_ID;
connection.connect
(
	function (err, conn) {
		if(err) {
			console.error('Unable to connect: ' + err.message);
		}
		else {
			console.log('Successfully connected to Snowflake.');
			// Optional: store the connection ID.
			connection_ID = conn.getId();
			UseSchema();
		}
	}
);

function UseSchema()
{
	console.log('use schema');
	var schemaStatement = connection.execute({
		sqlText: useSchema,
		complete: function (err) {
			if (err) {
				console.error('0 failed to change schema: ' + err.message);
			}
			else {
				CreateTable();
			}
		}
	});
}

function CreateTable()
{
	console.log('create table execute.');
	var statement = connection.execute({
		sqlText: createTestTbl,
		complete: function (err, stmt, rows) {
			if (err) {
				console.error('1 Failed to execute statement due to the following error: ' + err.message);
			} else {
				InsertTable();
			}
		}
	});
}

function InsertTable()
{
	console.log('insert table execute.');
	var arrBind = [];
	for(var i = 0; i<200000; i++)
	{
		arrBind.push(['string'+i, i, "2020-05-11", "12:35:41.3333333", "2022-04-01 23:59:59", "2022-07-08 12:05:30.9999999"]);
	}
	
	var insertStatement = connection.execute({
		sqlText: insertWithQmark,
		binds: arrBind,
		complete: function (err) {
			if (err) {
				console.error('1 Failed to execute statement due to the following error: ' + err.message);
			}
			else {
				CloseConnection();
			}
		}
	});
}

function CloseConnection()
{
	connection.destroy();
}