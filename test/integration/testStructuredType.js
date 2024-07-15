/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const async = require('async');
const GlobalConfig = require('./../../lib/global_config');
const snowflake = require('./../../lib/snowflake');
const testUtil = require('./testUtil');
const sharedStatement = require('./sharedStatements');
const bigInt = require('big-integer');

describe('Test DataType', function () {
  let connection;
  const selectObject = 'select {\'string\':\'a\'}::OBJECT(string VARCHAR) as result';
  // const selectNumber = 'select * from testNumber';
  // const selectVariant = 'select * from testVariant';
  // const selectArray = 'select * from testArray';
  // const selectDate = 'select * from testDate';
  // const selectTime = 'select * from testTime';
  // const selectTimestamp = 'select * from testTimestamp';
  // const selectBoolean = 'select * from testBoolean';
  // const selectString = 'select * from testString';

  before(function (done) {
    connection = testUtil.createConnection({ 'proxyHost': '127.0.0.1', 'proxyPort': 8080 });
    async.series([
      function (callback) {
        snowflake.configure({ 'insecureConnect': true });
        GlobalConfig.setInsecureConnect(true);
        testUtil.connect(connection, callback);
      }],
    done
    );
  });

  // after(function (done) {
  //   async.series([
  //     function (callback) {
  //       testUtil.executeCmd(connection, selectObject, callback);
  //     },
  //     function (callback) {
  //       testUtil.executeCmd(connection, dropTableWithVariant, callback);
  //     },
  //     function (callback) {
  //       testUtil.executeCmd(connection, dropTableWithArray, callback);
  //     },
  //     function (callback) {
  //       testUtil.executeCmd(connection, dropTableWithNumber, callback);
  //     },
  //     function (callback) {
  //       testUtil.executeCmd(connection, dropTableWithDouble, callback);
  //     },
  //     function (callback) {
  //       testUtil.executeCmd(connection, dropTableWithDate, callback);
  //     },
  //     function (callback) {
  //       testUtil.executeCmd(connection, dropTableWithTime, callback);
  //     },
  //     function (callback) {
  //       testUtil.executeCmd(connection, dropTableWithTimestamp, callback);
  //     },
  //     function (callback) {
  //       testUtil.executeCmd(connection, dropTableWithBoolean, callback);
  //     },
  //     function (callback) {
  //       testUtil.destroyConnection(connection, callback);
  //     }],
  //   done
  //   );
  // });

  describe('testNumber', function () {
    it('testObject', function (done) {
      async.series([
        function (callback) {
          testUtil.executeCmd(connection, 'alter session set ENABLE_STRUCTURED_TYPES_IN_CLIENT_RESPONSE = true', callback);
        },
        function (callback) {
          testUtil.executeCmd(connection, 'alter session set IGNORE_CLIENT_VESRION_IN_STRUCTURED_TYPES_RESPONSE = true', callback);
        },
        function (callback) {
          testUtil.executeQueryAndVerify(
            connection,
            selectObject,
            [{ 'string': 'a' }],
            callback
          );
        }],
      done
      );
    });
  });

});
