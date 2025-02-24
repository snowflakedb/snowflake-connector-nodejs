const snowflake = require('../lib/snowflake');
const async = require('async');
const testUtil = require('../test/integration/testUtil');
const connOptions = require('./connectionOptions');


describe('testProxy', function () {
  it('testConnectionWithProxy', function (done) {
    const connection = snowflake.createConnection(connOptions.connectionWithProxy);
    async.series(
      [
        function (callback) {
          testUtil.connect(connection, callback);
        },
        function (callback) {
          testUtil.destroyConnection(connection, callback);
        }
      ],
      done
    );
  });

  it('testSimpleSelectWithProxy', function (done) {
    const connection = snowflake.createConnection(connOptions.connectionWithProxy);
    async.series(
      [
        function (callback) {
          testUtil.connect(connection, callback);
        },
        function (callback) {
          testUtil.executeCmd(
            connection,
            'create or replace table testProxy(colA string)',
            callback
          );
        },
        function (callback) {
          testUtil.executeCmd(
            connection,
            'insert into testProxy values(\'testString\')',
            callback
          );
        },
        function (callback) {
          testUtil.executeQueryAndVerify(
            connection,
            'select * from testProxy',
            [{ 'COLA': 'testString' }],
            callback
          );
        },
        function (callback) {
          testUtil.executeCmd(
            connection,
            'drop table if exists testProxy',
            callback
          );
        }
      ],
      done
    );
  });
});
