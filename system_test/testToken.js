const snowflake = require('./../lib/snowflake');
const assert = require('assert');
const connOption = require('../test/integration/connectionOptions');
const testUtil = require('../test/integration/testUtil');
const async = require('async');

describe('testLoginTokenExpire', function () {
  before(function (done) {
    const connectionToSnowflake = snowflake.createConnection(connOption.snowflakeAccount);
    async.series(
      [
        function (callback) {
          connectionToSnowflake.connect(function (err) {
            testUtil.checkError(err);
            callback();
          });
        },
        function (callback) {
          testUtil.executeCmd(
            connectionToSnowflake,
            'alter system set MASTER_TOKEN_VALIDITY=5',
            callback
          );
        },
        function (callback) {
          testUtil.executeCmd(
            connectionToSnowflake,
            'alter system set SESSION_TOKEN_VALIDITY=2',
            callback
          );
        },
        function (callback) {
          connectionToSnowflake.destroy(function (err) {
            testUtil.checkError(err);
            callback();
          });
        }
      ],
      done
    );
  });

  after(function (done) {
    const connectionToSnowflake = snowflake.createConnection(connOption.snowflakeAccount);
    async.series(
      [
        function (callback) {
          connectionToSnowflake.connect(function (err) {
            testUtil.checkError(err);
            callback();
          });
        },
        function (callback) {
          testUtil.executeCmd(
            connectionToSnowflake,
            'alter system set MASTER_TOKEN_VALIDITY=default',
            callback
          );
        },
        function (callback) {
          testUtil.executeCmd(
            connectionToSnowflake,
            'alter system set SESSION_TOKEN_VALIDITY=default',
            callback
          );
        },
        function (callback) {
          connectionToSnowflake.destroy(function (err) {
            testUtil.checkError(err);
            callback();
          });
        }
      ],
      done
    );
  });

  it('testSessionToken', function (done) {
    const connection = snowflake.createConnection(connOption.valid);
    async.series(
      [
        function (callback) {
          testUtil.connect(connection, callback);
        },
        function (callback) {
          // wait 3 seconds to let session token expired
          setTimeout(function () {
            callback();
          }, 3000);
        },
        function (callback) {
          // the session should refreshed and the sql should succeed
          testUtil.executeCmd(
            connection,
            'select seq8() from table(generator(rowcount=>10))',
            callback
          );
        }
      ],
      done
    );
  });

  it('testMasterTokenExpire', function (done) {
    const connection = snowflake.createConnection(connOption.valid);
    async.series(
      [
        function (callback) {
          testUtil.connect(connection, callback);
        },
        function (callback) {
          // wait 10 seconds to let master token expire
          setTimeout(function () {
            callback();
          }, 10000);
        },
        function (callback) {
          connection.execute({
            sqlText: 'create or replace table t(colA varchar)',
            complete: function (err) {
              assert.ok(err);
              assert.strictEqual(err.message, 'Unable to perform ' +
                'operation using terminated connection.');
              callback();
            }
          });
        }
      ],
      done
    );
  });
});
