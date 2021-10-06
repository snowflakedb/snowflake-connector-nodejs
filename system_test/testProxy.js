/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
var snowflake = require('../lib/snowflake');
var async = require('async');
var testUtil = require('../test/integration/testUtil');
var connOptions = require('./connectionOptions');


describe('testProxy', function ()
{
  it('testConnectionWithProxy', function (done)
  {
    var connection = snowflake.createConnection(connOptions.connectionWithProxy);
    async.series(
      [
        function (callback)
        {
          testUtil.connect(connection, callback);
        }
      ],
      done
    );
  });

  it('testSimpleSelectWithProxy', function (done)
  {
    var connection = snowflake.createConnection(connOptions.connectionWithProxy);
    async.series(
      [
        function (callback)
        {
          testUtil.connect(connection, callback);
        },
        function (callback)
        {
          testUtil.executeCmd(
            connection,
            'create or replace table testProxy(colA string)',
            callback
          );
        },
        function (callback)
        {
          testUtil.executeCmd(
            connection,
            'insert into testProxy values(\'testString\')',
            callback
          );
        },
        function (callback)
        {
          testUtil.executeQueryAndVerify(
            connection,
            'select * from testProxy',
            [{'COLA': 'testString'}],
            callback
          );
        },
        function (callback)
        {
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
