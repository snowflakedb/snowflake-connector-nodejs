const snowflake = require('./../lib/snowflake');
const connOption = require('../test/integration/connectionOptions');
const testUtil = require('../test/integration/testUtil');
const async = require('async');

// This test can run only if Snowflake account is available.
const canRunTest = connOption.snowflakeAccount !== undefined;

describe('testPingPong', function () {
  before(function (done) {
    if (!canRunTest) {
      done();
    }
    const connectionToSnowflake = snowflake.createConnection(connOption.snowflakeAccount);
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
    const connectionToSnowflake = snowflake.createConnection(connOption.snowflakeAccount);
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

  it('testLongRunning', function (done) {
    if (!canRunTest) {
      this.skip();
      done();
      return;
    }
    const connection = testUtil.createConnection();
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
