/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
var snowflake = require('./../lib/snowflake');
var assert = require('assert');
var connOption = require('../test/integration/connectionOptions');
var testUtil = require('../test/integration/testUtil');
var async = require('async');

describe('testLoginTokenExpire', function ()
{
  before(function (done)
  {
    var connectionToSnowflake = snowflake.createConnection(connOption.snowflakeAccount);
    async.series(
      [
        function (callback)
        {
          connectionToSnowflake.connect(function (err)
          {
            testUtil.checkError(err);
            callback();
          });
        },
        function (callback)
        {
          testUtil.executeCmd(
            connectionToSnowflake,
            'alter system set MASTER_TOKEN_VALIDITY=5',
            callback
          );
        },
        function (callback)
        {
          testUtil.executeCmd(
            connectionToSnowflake,
            'alter system set SESSION_TOKEN_VALIDITY=2',
            callback
          );
        },
        function (callback)
        {
          connectionToSnowflake.destroy(function (err)
          {
            testUtil.checkError(err);
            callback();
          });
        }
      ],
      done
    );
  });

  after(function (done)
  {
    var connectionToSnowflake = snowflake.createConnection(connOption.snowflakeAccount);
    async.series(
      [
        function (callback)
        {
          connectionToSnowflake.connect(function (err)
          {
            testUtil.checkError(err);
            callback();
          });
        },
        function (callback)
        {
          testUtil.executeCmd(
            connectionToSnowflake,
            'alter system set MASTER_TOKEN_VALIDITY=default',
            callback
          );
        },
        function (callback)
        {
          testUtil.executeCmd(
            connectionToSnowflake,
            'alter system set SESSION_TOKEN_VALIDITY=default',
            callback
          );
        },
        function (callback)
        {
          connectionToSnowflake.destroy(function (err)
          {
            testUtil.checkError(err);
            callback();
          });
        }
      ],
      done
    );
  });

  it('testSessionToken', function (done)
  {
    var connection = snowflake.createConnection(connOption.valid);
    async.series(
      [
        function (callback)
        {
          testUtil.connect(connection, callback);
        },
        function (callback)
        {
          // wait 3 seconds to let session token expired
          setTimeout(function ()
          {
            callback();
          }, 3000);
        },
        function (callback)
        {
          // the session should refreshed and the sql should succeed
          testUtil.executeCmd(
            connection,
            'select * from orders limit 10',
            callback
          );
        }
      ],
      done
    );
  });

  it('testMasterTokenExpire', function (done)
  {
    var connection = snowflake.createConnection(connOption.valid);
    async.series(
      [
        function (callback)
        {
          testUtil.connect(connection, callback);
        },
        function (callback)
        {
          // wait 10 seconds to let master token expire
          setTimeout(function ()
          {
            callback();
          }, 10000);
        },
        function (callback)
        {
          connection.execute({
            sqlText: 'create or replace table t(colA varchar)',
            complete: function (err)
            {
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
