/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
const assert = require('assert');
const testUtil = require('./testUtil');

describe('Test Stage Binding with Customer Table', function () {
  this.timeout(300000);
  this.retries(3); // this test suit are considered as flaky test

  let connection;
  const tableName = 'EVENTS_TEMP';
  const createTable = `create or replace TABLE ${tableName} (ORGANIZATION_ID VARCHAR(16777216),` +
    'APP_ID VARCHAR(16777216), OCCURREDAT VARCHAR(16777216), SHOP_ID VARCHAR(16777216),' +
    'TYPE VARCHAR(16777216),ID VARCHAR(16777216),CHARGE_AMOUNT_AMOUNT FLOAT,' +
    'CHARGE_AMOUNT_CURRENCYCODE VARCHAR(16777216),CHARGE_ID VARCHAR(16777216),' +
    'CHARGE_NAME VARCHAR(16777216),CHARGE_TEST VARCHAR(16777216),CHARGE_BILLINGON VARCHAR(16777216),' +
    'REASON VARCHAR(16777216),DESCRIPTION VARCHAR(16777216),APPCREDIT_AMOUNT_AMOUNT FLOAT,' +
    'APPCREDIT_AMOUNT_CURRENCYCODE VARCHAR(16777216),APPCREDIT_ID VARCHAR(16777216),' +
    'APPCREDIT_NAME VARCHAR(16777216),APPCREDIT_TEST VARCHAR(16777216),APP_NAME VARCHAR(16777216),' +
    'SHOP_MYSHOPIFYDOMAIN VARCHAR(16777216),SHOP_NAME VARCHAR(16777216),APP_APIKEY VARCHAR(16777216))';
  const insertWithQmark = `insert into ${tableName} values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  before(async () => {
    connection = testUtil.createConnection();
    await testUtil.connectAsync(connection);
    await testUtil.executeCmdAsync(connection, createTable);
  });

  after(async () => {
    await testUtil.dropTablesIgnoringErrorsAsync(connection, [tableName]);
    await testUtil.destroyConnectionAsync(connection);
  });

  it('testArrayBindCustomerTable', function (done) {
    const arrBind = [];
    const rowsToInsert = 10000; // 100000 rows causes "Statement exhausted compilation resources and was canceled. Please contact support." in regression environment
    for (let i = 0; i < rowsToInsert; i++) {
      arrBind.push(['string' + i, 'appid', 'occuredat', 'shopid', 'type', 'id', 10.9, 'charge amount currency code',
        'chargeid', 'chargename', 'chargetest', 'chargebillingon', 'reason', 'description', 99.99, 'appcredit amount currency code',
        'appcreditid', 'appcreditname', 'appcredittest', 'appname', 'shopmyshopifyoumin', 'shopname', 'appapikey']);
    }
    connection.execute({
      sqlText: insertWithQmark,
      binds: arrBind,
      complete: function (err, stmt) {
        if (err) {
          done(err);
        } else {
          try {
            assert.strictEqual(stmt.getNumUpdatedRows(), rowsToInsert);
            done();
          } catch (e) {
            done(e);
          }
        }
      }
    });
  });
});
