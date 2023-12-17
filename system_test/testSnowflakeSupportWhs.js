/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

/**
 * These tests are currently run as part of RT-Language5, but should be
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
  // get the current time in seconds
  const nowInEpochSecs = Math.floor(Date.now() / 1000);

  // use it to create a unique-ish warehouse name
  const supportWhName = 'WH_' + nowInEpochSecs;

  // define the window for which we'll be requesting warehouse metrics
  // const startTime = nowInEpochSecs - 24 * 3600;
  // const endTime = nowInEpochSecs + 24 * 3600;

  // number of credits we charge per hour for a standard xsmall warehouse
  // const standardXsmallCredits = 1;

  const createSupportWh = util.format('create or replace warehouse %s ' +
    'warehouse_size = \'xsmall\'', supportWhName);
  const dropSupportWh = util.format('drop warehouse %s', supportWhName);

  const createTestDb = 'create or replace database node_testdb';
  const dropTestDb = 'drop database node_testdb';

  const setServerTypeStandard = 'alter account externalaccount set ' +
    'server_type = \'STANDARD\'';

  const enableJobScanFns = 'alter account externalaccount set ' +
    'enable_jobscan_functions = true';
  const unsetJobScanFns = 'alter account externalaccount set ' +
    'enable_jobscan_functions = default';

  // const now = new Date();

  // get the current year as yy
  // const currentYear = Number(now.getFullYear().toString().substr(2));

  // subtract a year from the current date and get the result as a string in the
  // following format: MM/dd/yy
  // const todayLastYearAsString =
  //   (now.getMonth() + 1) + '/' + now.getDate() + '/' + (currentYear - 1);

  // add a year to the current date and get the result as a string in the
  // following format: MM/dd/yy
  // const todayNextYearAsString =
  //   (now.getMonth() + 1) + '/' + now.getDate() + '/' + (currentYear + 1);

  // warehouse exclusion can be enabled by setting the exclude start date to a
  // year ago
  // const enableWhExclusion = util.format('alter system set ' +
  //   'EXCLUDE_SUPPORT_WHS_START_DATE = \'%s\'', todayLastYearAsString);

  // warehouse exclusion can be disabled by setting the exclude start date to a
  // year from now
  // const disableWhExclusion = util.format('alter system set ' +
  //   'EXCLUDE_SUPPORT_WHS_START_DATE = \'%s\'', todayNextYearAsString);

  // const unsetWhExclusion =
  //   'alter system set EXCLUDE_SUPPORT_WHS_START_DATE = default';

  // const enableSupportWhFlag = util.format(
  //   'alter warehouse externalaccount.%s set snowflake_support = true',
  //   supportWhName);
  // const disableSupportWhFlag = util.format(
  //   'alter warehouse externalaccount.%s set snowflake_support = false',
  //   supportWhName);

  // create two connections, one to externalaccount and another to the snowflake
  // account
  const connExternal = snowflake.createConnection(connOptionsInternal.externalAccount);
  const connSnowflake = snowflake.createConnection(connOptions.snowflakeAccount);

  // the original server_type for externalaccount
  let externalAccServerTypeOrig;

  before(function (done) {
    async.series([
      function (callback) {
        // set up the connection to the snowflake account
        testUtil.connect(connSnowflake, callback);
      },
      function (callback) {
        // enable support to get warehouse metrics from externalaccount
        testUtil.executeCmd(connSnowflake, enableJobScanFns, callback);
      },
      function (callback) {
        // get the original server_type for externalaccount
        connSnowflake.execute(
          {
            sqlText: 'show accounts like \'externalaccount\'',
            complete: function (err, statement, rows) {
              assert.ok(!err);
              assert.ok(util.isArray(rows) && (rows.length === 1));

              // extract the server type and save it for later use
              externalAccServerTypeOrig = rows[0]['server type'];

              // we're done; invoke the callback
              callback();
            }
          });
      },
      function (callback) {
        // change the server type in externalaccount to standard
        testUtil.executeCmd(connSnowflake, setServerTypeStandard, callback);
      },
      function (callback) {
        // set up the connection to externalaccount
        testUtil.connect(connExternal, callback);
      },
      function (callback) {
        // create a database in externalaccount so we can use information
        // schema
        testUtil.executeCmd(connExternal, createTestDb, callback);
      },
      function (callback) {
        // create a support warehouse in externalaccount to test warehouse
        // metrics
        testUtil.executeCmd(connExternal, createSupportWh, callback);
      }],
    done
    );
  });

  // clean up
  after(function (done) {
    async.series([
      function (callback) {
        // unset feature flag to get warehouse metrics from externalaccount
        testUtil.executeCmd(connSnowflake, unsetJobScanFns, callback);
      },
      function (callback) {
        // change the server_type in externalaccount back to its original value
        const sqlText = util.format(
          'alter account externalaccount set server_type = \'%s\'',
          externalAccServerTypeOrig);
        testUtil.executeCmd(connSnowflake, sqlText, callback);
      },
      function (callback) {
        // destroy the connection to the snowflake account
        testUtil.destroyConnection(connSnowflake, callback);
      },
      function (callback) {
        // drop the support warehouse we created in externalaccount
        testUtil.executeCmd(connExternal, dropSupportWh, callback);
      },
      function (callback) {
        // drop the database we created in externalaccount to get information
        // schema
        testUtil.executeCmd(connExternal, dropTestDb, callback);
      },
      function (callback) {
        // destroy the connection to externalaccount
        testUtil.destroyConnection(connExternal, callback);
      }],
    done
    );
  });

  ///**
  // * Tests the customer's billing view. Credits for the test warehouse should
  // * only be excluded from the bill if the 'exclude_support_whs_from_bill'
  // * system parameter is set and the test warehouse is marked with the
  // * 'snowflake_support' flag.
  // */
  //it('customer account view', function(done)
  //{
  //  async.series([
  //      function(callback)
  //      {
  //        // disable the support-wh-exclusion feature flag
  //        testUtil.executeCmd(connSnowflake, disableWhExclusion, callback);
  //      },
  //      function(callback)
  //      {
  //        // make sure warehouse credits are included in the bill by default
  //        assertCreditsFromExternalAcc(
  //            connExternal, standardXsmallCredits, callback);
  //      },
  //      function(callback)
  //      {
  //        // enable the support-wh-exclusion feature flag
  //        testUtil.executeCmd(connSnowflake, enableWhExclusion, callback);
  //      },
  //      function(callback)
  //      {
  //        // make sure warehouse credits are included in the bill
  //        assertCreditsFromExternalAcc(
  //            connExternal, standardXsmallCredits, callback);
  //      },
  //      function(callback)
  //      {
  //        // enable the snowflake_support flag for the test warehouse
  //        testUtil.executeCmd(connSnowflake, enableSupportWhFlag, callback);
  //      },
  //      function(callback)
  //      {
  //        // make sure warehouse credits are excluded from the bill
  //        assertCreditsFromExternalAcc(connExternal, 0, callback);
  //      },
  //      function(callback)
  //      {
  //        // disable the snowflake_support flag for the test warehouse
  //        testUtil.executeCmd(connSnowflake, disableSupportWhFlag, callback);
  //      },
  //      function(callback)
  //      {
  //        // make sure warehouse credits are included in the bill
  //        assertCreditsFromExternalAcc(
  //            connExternal, standardXsmallCredits, callback);
  //      },
  //      function(callback)
  //      {
  //        // unset the support-wh-exclusion feature flag
  //        testUtil.executeCmd(connSnowflake, unsetWhExclusion, callback);
  //      }],
  //    done
  //  );
  //});

  /**
   * Tests the snowflake account's billing view. Credits for the test warehouse
   * should only be excluded from the bill if the 'exclude_support_whs_from_bill'
   * system parameter is set, we explicitly request a view of the billing
   * metrics that excludes support warehouses, and the test warehouse is marked
   * with the 'snowflake_support' flag.
   */
  //it('snowflake account view', function(done)
  //{
  //  // a = the support-wh-exclusion feature flag
  //  // b = whether we're requesting a view of the billing metrics that excludes
  //  //     support warehouses
  //  // c = the snowflake_support flag for test warehouse
  //
  //  async.series([
  //      function(callback)
  //      {
  //        // disable the support-wh-exclusion feature flag
  //        testUtil.executeCmd(connSnowflake, disableWhExclusion, callback);
  //      },
  //      function(callback)
  //      {
  //        // make sure warehouse credits are included in the bill
  //        // a = false, b = false, c = false
  //        assertCreditsFromSnowflakeAcc(
  //            connSnowflake, false, standardXsmallCredits, callback);
  //      },
  //      function(callback)
  //      {
  //        // enable the snowflake_support flag for the test warehouse
  //        testUtil.executeCmd(connSnowflake, enableSupportWhFlag, callback);
  //      },
  //      function(callback)
  //      {
  //        // make sure warehouse credits are included in the bill
  //        // a = false, b = false, c = true
  //        assertCreditsFromSnowflakeAcc(
  //            connSnowflake, false, standardXsmallCredits, callback);
  //      },
  //      function(callback)
  //      {
  //        // disable the snowflake_support flag for the test warehouse
  //        testUtil.executeCmd(connSnowflake, disableSupportWhFlag, callback);
  //      },
  //      function(callback)
  //      {
  //        // make sure warehouse credits are included in the bill
  //        // a = false, b = true, c = false
  //        assertCreditsFromSnowflakeAcc(
  //            connSnowflake, true, standardXsmallCredits, callback);
  //      },
  //      function(callback)
  //      {
  //        // enable the snowflake_support flag for the test warehouse
  //        testUtil.executeCmd(connSnowflake, enableSupportWhFlag, callback);
  //      },
  //      function(callback)
  //      {
  //        // make sure warehouse credits are included in the bill
  //        // a = false, b = true, c = true
  //        assertCreditsFromSnowflakeAcc(
  //            connSnowflake, true, standardXsmallCredits, callback);
  //      },
  //      function(callback)
  //      {
  //        // disable the snowflake_support flag for the test warehouse
  //        testUtil.executeCmd(connSnowflake, disableSupportWhFlag, callback);
  //      },
  //      function(callback)
  //      {
  //        // enable the support-wh-exclusion feature flag
  //        testUtil.executeCmd(connSnowflake, enableWhExclusion, callback);
  //      },
  //      function(callback)
  //      {
  //        // make sure warehouse credits are included in the bill
  //        // a = true, b = false, c = false
  //        assertCreditsFromSnowflakeAcc(
  //            connSnowflake, false, standardXsmallCredits, callback);
  //      },
  //      function(callback)
  //      {
  //        // enable the snowflake_support flag for the test warehouse
  //        testUtil.executeCmd(connSnowflake, enableSupportWhFlag, callback);
  //      },
  //      function(callback)
  //      {
  //        // make sure warehouse credits are included in the bill
  //        // a = true, b = false, c = true
  //        assertCreditsFromSnowflakeAcc(
  //            connSnowflake, false, standardXsmallCredits, callback);
  //      },
  //      function(callback)
  //      {
  //        // disable the snowflake_support flag for the test warehouse
  //        testUtil.executeCmd(connSnowflake, disableSupportWhFlag, callback);
  //      },
  //      function(callback)
  //      {
  //        // make sure warehouse credits are included in the bill
  //        // a = true, b = true, c = false
  //        assertCreditsFromSnowflakeAcc(
  //            connSnowflake, true, standardXsmallCredits, callback);
  //      },
  //      function(callback)
  //      {
  //        // enable the snowflake_support flag for the test warehouse
  //        testUtil.executeCmd(connSnowflake, enableSupportWhFlag, callback);
  //      },
  //      function(callback)
  //      {
  //        // make sure warehouse credits are excluded from the bill
  //        // a = true, b = true, c = true
  //        assertCreditsFromSnowflakeAcc(connSnowflake, true, 0, callback);
  //      },
  //      function(callback)
  //      {
  //        // disable the snowflake_support flag for the test warehouse
  //        testUtil.executeCmd(connSnowflake, disableSupportWhFlag, callback);
  //      },
  //      function(callback)
  //      {
  //        // unset the support-wh-exclusion feature flag
  //        testUtil.executeCmd(connSnowflake, unsetWhExclusion, callback);
  //      }],
  //    done
  //  );
  //});

  /**
   * Asynchronous function that can be used to assert whether the test warehouse
   * credits seen by externalaccount equal a certain value.
   *
   * @param conn the connection to use to make the request.
   * @param expected the expected number of credits.
   * @param cb the callback to invoke if the assert succeeds.
   */
  // function assertCreditsFromExternalAcc(conn, expected, cb) {
  //   const columnName = 'CREDITS';
  //   const sqlText =
  //     util.format('select warehouse_name, sum(credits_used) as %s ' +
  //       'from table(information_schema.warehouse_metering_history(' +
  //       '%s::timestamp, %s::timestamp, \'%s\')) ' +
  //       'group by warehouse_name',
  //     columnName, startTime, endTime, supportWhName);
  //
  //   conn.execute(
  //     {
  //       sqlText: sqlText,
  //       complete: function (err, statement, rows) {
  //         assert.ok(!err);
  //         assert.ok(util.isArray(rows));
  //
  //         // the actual number of credits must equal the expected value
  //         const credits = (rows.length === 0) ? 0 : rows[0][columnName];
  //         assert.strictEqual(credits, expected);
  //
  //         // we're done; invoke the callback
  //         cb();
  //       }
  //     });
  // }

  /**
   * Asynchronous function that can be used to assert whether the test warehouse
   * credits seen by the snowflake account equal a certain value.
   *
   * @param conn the connection to use to make the request.
   * @param exclude whether to request a version of the billing metrics that
   *   excludes support warehouses.
   * @param expected the expected number of credits.
   * @param cb the callback to invoke if the assert succeeds.
   */
  // function assertCreditsFromSnowflakeAcc(conn, exclude, expected, cb) {
  //   const columnName = 'CREDITS';
  //   const sqlText = util.format('select system$get_metrics(' +
  //     '\'%s\', \'%s\', \'%s\', \'%s\'::timestamp, \'%s\'::timestamp, ' +
  //     'null, null, \'%s\', %s) as %s;',
  //   'ACCOUNT', 'EXTERNALACCOUNT', 'METERING',
  //   startTime, endTime, 'UTC', exclude, columnName);
  //
  //   conn.execute(
  //     {
  //       sqlText: sqlText,
  //       complete: function (err, statement, rows) {
  //         assert.ok(!err);
  //         assert.ok(rows && (rows.length === 1));
  //
  //         // convert the one-row-one-column result to JSON
  //         const response = JSON.parse(rows[0][columnName]);
  //         assert(util.isObject(response));
  //
  //         // extract the instance types
  //         const instanceTypes = response.instanceTypes;
  //         assert(util.isArray(instanceTypes));
  //
  //         // create a map in which the keys are instance types and the values are
  //         // the prices for the corresponding instance types
  //         const mapInstanceTypeToPrice = {};
  //         for (let index = 0, length = instanceTypes.length; index < length; index++) {
  //           const instanceType = instanceTypes[index];
  //           mapInstanceTypeToPrice[instanceType.id] = instanceType.price;
  //         }
  //
  //         // extract the aggregations
  //         const aggregations = response.aggregations;
  //         assert(util.isArray(aggregations));
  //
  //         // find the aggregation for the support warehouse
  //         let supportWhAggregation;
  //         for (let index = 0, length = aggregations.length; index < length; index++) {
  //           if (aggregations[index].name === supportWhName) {
  //             supportWhAggregation = aggregations[index];
  //           }
  //         }
  //
  //         let credits = 0;
  //
  //         // if we have an aggregation for the support warehouse
  //         if (util.isObject(supportWhAggregation)) {
  //           // extract the configs array; this contains information about the
  //           // total number of credits
  //           assert(util.isObject(supportWhAggregation.aggregate));
  //           const supportWhConfigs = supportWhAggregation.aggregate.config;
  //           assert(util.isArray(supportWhConfigs));
  //
  //           // convert the counts to credits
  //           for (let index = 0, length = supportWhConfigs.length; index < length; index++) {
  //             const config = supportWhConfigs[index];
  //             credits += mapInstanceTypeToPrice[config.type] * [config.count];
  //           }
  //         }
  //
  //         // the actual number of credits must equal the expected value
  //         assert.strictEqual(credits, expected);
  //
  //         // we're done; invoke the callback
  //         cb();
  //       }
  //     });
  // }
});