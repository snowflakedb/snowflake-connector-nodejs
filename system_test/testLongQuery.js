/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
var snowflake = require('./../lib/snowflake');
var connOption = require('../test/integration/connectionOptions');
var testUtil = require('../test/integration/testUtil');
var async = require('async');

// This test can run only if Snowflake account is available.
var canRunTest = connOption.snowflakeAccount !== undefined;

describe('testPingPong', function () {
  before(function (done) {
    if (!canRunTest) {
      done();
    }
    var connectionToSnowflake = snowflake.createConnection(connOption.snowflakeAccount);
    async.series(
      [
        function (callback) {
          testUtil.connect(connectionToSnowflake, callback);
        },
        function (callback) {
          testUtil.executeCmd(
            connectionToSnowflake,
            'alter system set CLIENT_HEALTH_CHECK_INTERVAL=2',
            callback
          );
        },
        function (callback) {
          testUtil.destroyConnection(connectionToSnowflake, callback);
        }
      ],
      done
    );
  });

  after(function (done) {
    if (!canRunTest) {
      done();
      return;
    }
    var connectionToSnowflake = snowflake.createConnection(connOption.snowflakeAccount);
    async.series(
      [
        function (callback) {
          testUtil.connect(connectionToSnowflake, callback);
        },
        function (callback) {
          testUtil.executeCmd(
            connectionToSnowflake,
            'alter system set CLIENT_HEALTH_CHECK_INTERVAL=default',
            callback
          );
        },
        function (callback) {
          testUtil.destroyConnection(connectionToSnowflake, callback);
        }
      ],
      done
    );
  });

  it("testLongRunning", function (done) {
    if (!canRunTest) {
      this.skip();
      done();
      return;
    }
    var connection = testUtil.createConnection();
    async.series(
      [
        function (callback) {
          testUtil.connect(connection, callback);
        },
        function (callback) {
          testUtil.executeCmd(
            connection,
            'select count(*) from table(generator(timeLimit =>10))',
            callback
          );
        },
        function (callback) {
          testUtil.destroyConnection(connection, callback);
        }
      ],
      done
    );
  });
});
