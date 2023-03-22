/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
var async = require('async');
var assert = require('assert');
var testUtil = require('./testUtil');
const v8 = require('v8');

const sourceRowCount = 30000;

describe('Test Concurrent Execution', function ()
{
  this.timeout(300000);
  var connection;
  var createTable = 'create or replace TABLE EVENTS_TEMP (ORGANIZATION_ID VARCHAR(16777216),' +
	'APP_ID VARCHAR(16777216), OCCURREDAT VARCHAR(16777216), SHOP_ID VARCHAR(16777216),' +
	'TYPE VARCHAR(16777216),ID VARCHAR(16777216),CHARGE_AMOUNT_AMOUNT FLOAT,' +
	'CHARGE_AMOUNT_CURRENCYCODE VARCHAR(16777216),CHARGE_ID VARCHAR(16777216),' +
	'CHARGE_NAME VARCHAR(16777216),CHARGE_TEST VARCHAR(16777216),CHARGE_BILLINGON VARCHAR(16777216),' +
	'REASON VARCHAR(16777216),DESCRIPTION VARCHAR(16777216),APPCREDIT_AMOUNT_AMOUNT FLOAT,' +
	'APPCREDIT_AMOUNT_CURRENCYCODE VARCHAR(16777216),APPCREDIT_ID VARCHAR(16777216),'+
	'APPCREDIT_NAME VARCHAR(16777216),APPCREDIT_TEST VARCHAR(16777216),APP_NAME VARCHAR(16777216),'+
	'SHOP_MYSHOPIFYDOMAIN VARCHAR(16777216),SHOP_NAME VARCHAR(16777216),APP_APIKEY VARCHAR(16777216))';
  var insertWithQmark = 'insert into EVENTS_TEMP values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';

  before(function (done)
  {
	  console.log(v8.getHeapStatistics());
    connection = testUtil.createConnection();
    testUtil.connect(connection, function ()
    {
      connection.execute({
        sqlText: createTable,
        complete: function (err)
        {
          testUtil.checkError(err);
          if(err)
          {
            done(err);
          }
          else
          {
            done();
          }
        }
      });
    });
  });

  after(function (done)
  {
    testUtil.destroyConnection(connection, done);
	console.log(v8.getHeapStatistics());
  });

  it('testArrayBindCustomerTable', function (done)
  {
	var arrBind = [];
	var count = 500000;
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
      if(err)
      {
        done(err);
      }
      else
      {
        done();
      }
		}
	});
  });
});
