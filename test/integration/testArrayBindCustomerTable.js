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

describe('Test Concurrent Execution', function ()
{
  var connection;
  var createTable = `create or replace TABLE ${DATABASE_NAME}.${SCHEMA_NAME}.EVENTS_TEMP (ORGANIZATION_ID VARCHAR(16777216),` +
	'APP_ID VARCHAR(16777216), OCCURREDAT VARCHAR(16777216), SHOP_ID VARCHAR(16777216),' +
	'TYPE VARCHAR(16777216),ID VARCHAR(16777216),CHARGE_AMOUNT_AMOUNT FLOAT,' +
	'CHARGE_AMOUNT_CURRENCYCODE VARCHAR(16777216),CHARGE_ID VARCHAR(16777216),' +
	'CHARGE_NAME VARCHAR(16777216),CHARGE_TEST VARCHAR(16777216),CHARGE_BILLINGON VARCHAR(16777216),' +
	'REASON VARCHAR(16777216),DESCRIPTION VARCHAR(16777216),APPCREDIT_AMOUNT_AMOUNT FLOAT,' +
	'APPCREDIT_AMOUNT_CURRENCYCODE VARCHAR(16777216),APPCREDIT_ID VARCHAR(16777216),'+
	'APPCREDIT_NAME VARCHAR(16777216),APPCREDIT_TEST VARCHAR(16777216),APP_NAME VARCHAR(16777216),'+
	'SHOP_MYSHOPIFYDOMAIN VARCHAR(16777216),SHOP_NAME VARCHAR(16777216),APP_APIKEY VARCHAR(16777216))';
  var insertWithQmark = `insert into ${DATABASE_NAME}.${SCHEMA_NAME}.EVENTS_TEMP values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

  before(function (done)
  {
    connection = testUtil.createConnection();
    console.log('create table');
    testUtil.connect(connection, function ()
    {
      connection.execute({
        sqlText: createTable,
        complete: function (err)
        {
          testUtil.checkError(err);
          console.log('create table success');
          done();
        }
      });
    });
  });

  after(function (done)
  {
    testUtil.destroyConnection(connection, done);
  });

  it('testArrayBindCustomerTable', function (done)
  {
    console.log('insert table');
	var arrBind = [];
	var count = 6000;
	for(var i = 0; i<count; i++)
	{
		arrBind.push(['string'+i, 'appid', "occuredat", "shopid", "type", "id", 10.9, "charge amount currency code",
		'chargeid','chargename','chargetest','chargebillingon', 'reason', 'description', 99.99, 'appcredit amount currency code',
		'appcreditid','appcreditname','appcredittest','appname','shopmyshopifyoumin','shopname','appapikey']);
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
