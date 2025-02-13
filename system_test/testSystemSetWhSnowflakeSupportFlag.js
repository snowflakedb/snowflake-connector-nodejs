/**
 * These tests are currently run as part of RT-LanguageN, but should be
 * moved into a different suite at some point because they really test GS
 * functionality more than core driver behavior.
 */
const assert = require('assert');
const async = require('async');
const util = require('util');
const snowflake = require('../lib/snowflake');
const connOptions = require('../test/integration/connectionOptions');
const connOptionsInternal = require('./connectionOptions');
const testUtil = require('../test/integration/testUtil');

describe('exclude support warehouses', function () {
  const createSysWh =
    'create or replace warehouse syswh warehouse_size = \'xsmall\'';
  const dropSysWh = 'drop warehouse syswh';

  const testWhName = 'SF_TEST_WH';

  const createTestWh = util.format('create or replace warehouse %s ' +
    'warehouse_size = \'xsmall\'', testWhName);
  const dropTestWh = util.format('drop warehouse %s', testWhName);

  // create two connections, one to externalaccount and another to the snowflake
  // account
  const connExternal = snowflake.createConnection(connOptionsInternal.externalAccount);
  const connSnowflake = snowflake.createConnection(connOptions.snowflakeAccount);

  before(function (done) {
    async.series([
      function (callback) {
        // set up the connection to the snowflake account
        testUtil.connect(connSnowflake, callback);
      },
      function (callback) {
        // create a warehouse to run json queries in the snowflake account
        testUtil.executeCmd(connSnowflake, createSysWh, callback);
      },
      function (callback) {
        // set up the connection to externalaccount
        testUtil.connect(connExternal, callback);
      }],
    done
    );
  });

  // clean up
  after(function (done) {
    async.series([
      function (callback) {
        // drop the warehouse we created in the snowflake account
        testUtil.executeCmd(connSnowflake, dropSysWh, callback);
      },
      function (callback) {
        // destroy the connection to the snowflake account
        testUtil.destroyConnection(connSnowflake, callback);
      },
      function (callback) {
        // destroy the connection to externalaccount
        testUtil.destroyConnection(connExternal, callback);
      }],
    done
    );
  });

  /**
   * Tests that system$set_wh_snowflake_support_flag() can be used to set the
   * snowflake_support flag on both active and dropped warehouses.
   */
  it('set the snowflake_support flag on both active and dropped warehouse', function (done) {
    let testWhId;

    async.series([
      function (cb) {
        // create a test warehouse in externalaccount
        testUtil.executeCmd(connExternal, createTestWh, cb);
      },
      function (cb) {
        // get the warehouse id of the test warehouse
        getWarehouseId(connSnowflake, 'EXTERNALACCOUNT', testWhName,
          function (warehouseId) {
            testWhId = warehouseId;
            cb();
          });
      },
      function (cb) {
        // enable the snowflake_support flag for the test warehouse
        setWhSnowflakeSupportFlag(connSnowflake, testWhId, true, cb);
      },
      function (cb) {
        // verify that the snowflake_support flag is true
        assertSnowflakeSupportFlag(connSnowflake, testWhId, true, cb);
      },
      function (cb) {
        // disable the snowflake_support flag for the test warehouse
        setWhSnowflakeSupportFlag(connSnowflake, testWhId, false, cb);
      },
      function (cb) {
        // verify that the snowflake_support flag is false
        assertSnowflakeSupportFlag(connSnowflake, testWhId, false, cb);
      },
      function (cb) {
        // drop the test warehouse from externalaccount
        testUtil.executeCmd(connExternal, dropTestWh, cb);
      },
      function (cb) {
        // enable the snowflake_support flag for the test warehouse
        setWhSnowflakeSupportFlag(connSnowflake, testWhId, true, cb);
      },
      function (cb) {
        // verify that the snowflake_support flag is true
        assertSnowflakeSupportFlag(connSnowflake, testWhId, true, cb);
      },
      function (cb) {
        // disable the snowflake_support flag for the test warehouse
        setWhSnowflakeSupportFlag(connSnowflake, testWhId, false, cb);
      },
      function (cb) {
        // verify that the snowflake_support flag is false
        assertSnowflakeSupportFlag(connSnowflake, testWhId, false, cb);
      }],
    done
    );
  });

  /**
   * Asynchronous function that can be used to look up a warehouse id.
   *
   * @param conn the connection to use to make the request.
   * @param accountName the name of the account to which the warehouse belongs.
   * @param warehouseName the warehouse name.
   * @param callback the callback to invoke once the operation is complete.
   */
  function getWarehouseId(conn, accountName, warehouseName, callback) {
    const sqlText = util.format(
      'show warehouses like \'%s\' in %s', warehouseName, accountName);

    conn.execute(
      {
        sqlText: sqlText,
        complete: function (err, statement, rows) {
          assert.ok(!err);
          assert.ok(util.isArray(rows));
          assert.strictEqual(rows.length, 1);

          callback(rows[0].uuid);
        }
      });
  }

  /**
   * Asynchronous function that can be used to set the snowflake_support flag on
   * a given warehouse.
   *
   * @param conn the connection to use to make the request.
   * @param warehouseId the warehouse id of the warehouse whose
   *   snowflake_support flag is to be updated.
   * @param snowflakeSupportFlag the new value of the snowflake_support flag.
   * @param callback the callback to invoke once the operation is complete.
   */
  function setWhSnowflakeSupportFlag(
    conn, warehouseId, snowflakeSupportFlag, callback) {
    const sqlText = util.format(
      'select system$set_wh_snowflake_support_flag(%s, %s);',
      warehouseId, snowflakeSupportFlag);

    conn.execute(
      {
        sqlText: sqlText,
        complete: function (err) {
          assert.ok(!err);
          callback();
        }
      });
  }

  /**
   * Asynchronous function that can be used to assert whether a given warehouse
   * has its snowflake_support flag set to a certain value.
   *
   * @param conn the connection to use to make the request.
   * @param warehouseId the warehouse id of the warehouse to check.
   * @param expected the expected value of the snowflake_support flag.
   * @param callback the callback to invoke if the assert succeeds.
   */
  function assertSnowflakeSupportFlag(conn, warehouseId, expected, callback) {
    const columnName = 'FLAG';
    const sqlText = util.format(
      'select $1:"WarehouseDPO:primary":snowflakeSupportFlag::string as %s ' +
      'from table(dposcan($${"slices": [{"name": "WarehouseDPO:primary"}], ' +
      '"ranges": [{"name": "id", "value": %s}]}$$))', columnName, warehouseId);

    conn.execute(
      {
        sqlText: sqlText,
        complete: function (err, statement, rows) {
          assert.ok(!err);
          assert.ok(util.isArray(rows));
          assert.strictEqual(rows.length, 1);

          // the value is a string so compare with 'true' to convert to boolean
          const actualSnowflakeSupportFlag = (rows[0][columnName] === 'true');
          assert.strictEqual(actualSnowflakeSupportFlag, expected);

          // we're done; invoke the callback
          callback();
        }
      });
  }
});