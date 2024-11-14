const snowflake = require('./../../lib/snowflake');
const async = require('async');
const assert = require('assert');
const connOption = require('./connectionOptions');

if (process.env.LOCAL_USER_NAME === 'jenkins') {
  describe('Connection test - okta', function () {
    it('Simple Connect', function (done) {
      const connection = snowflake.createConnection(connOption.okta);

      async.series([
        function (callback) {
          connection.connectAsync(function (err) {
            done(err);
            assert.ok(!err, JSON.stringify(err));
            callback();
          });
        },
        function (callback) {
          assert.ok(connection.isUp(), 'not active');
          callback();
        },
        function (callback) {
          connection.destroy(function (err) {
            assert.ok(!err, JSON.stringify(err));
            callback();
          });
        },
        function (callback) {
          assert.ok(!connection.isUp(), 'still active');
          callback();
        },
      ]);
    });
  });
}
