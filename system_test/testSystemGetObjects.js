/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

/**
 * These tests are currently run as part of RT-LanguageN, but should be
 * moved into a different suite at some point because they really test GS
 * functionality more than core driver behavior.
 */

var assert = require('assert');
var async = require('async');
var util = require('util');
var snowflake = require('./../lib/snowflake');
var connOptions = require('../test/integration/connectionOptions');
var testUtil = require('../test/integration/testUtil');

describe('system$get_objects()', function ()
{
  var createDatabase = "create or replace database node_testdb;";
  var createSchema = "create or replace schema node_testschema;";
  var createTableT1 = "create or replace table t1 (c1 number);";
  var createTableT2 = "create or replace table t2 (c1 number);";
  var createViewV1 = "create or replace view v1 as select * from t1;";
  var createViewV2 = "create or replace view v2 as select * from t2;";
  var createViewV3 = "create or replace view v3 as select v1.c1 from v1, v2;";
  var createViewV4 = "create or replace view v4 as select * from v3;";
  var createStage = "create or replace stage test_stage " +
    "url = 's3://some_url';";
  var createFileFormat = "create or replace file format " +
    "test_file_format type = 'csv';";
  var createSequence = "create or replace sequence test_sequence;";
  var createSqlUdfAdd1Number = "create or replace function add1 (n number) " +
    "returns number as 'n + 1';";
  var createSqlUdfAdd1String = "create or replace function add1 (s string) " +
    "returns string as 's || ''1''';";
  var createJsUdfAdd1Double = "create or replace function add1 (n double) " +
    "returns double language javascript as " +
    "'return n + 1;';";
  var dropDatabase = "drop database node_testdb;";

  // create two connections, one to testaccount and another to the snowflake
  // account
  var connTestaccount = snowflake.createConnection(connOptions.valid);
  var connSnowflake = snowflake.createConnection(connOptions.snowflakeAccount);

  before(function (done)
  {
    // set up the two connections and create a bunch of objects in testaccount;
    // we'll run queries on these objects from testaccount, get the query id's
    // and verify that executing system$get_objects('execute [query_id];') from
    // the snowflake account produces the desired output
    async.series([
        function (callback)
        {
          testUtil.connect(connTestaccount, callback);
        },
        function (callback)
        {
          testUtil.executeCmd(connTestaccount, createDatabase, callback);
        },
        function (callback)
        {
          testUtil.executeCmd(connTestaccount, createSchema, callback);
        },
        function (callback)
        {
          testUtil.executeCmd(connTestaccount, createTableT1, callback);
        },
        function (callback)
        {
          testUtil.executeCmd(connTestaccount, createTableT2, callback);
        },
        function (callback)
        {
          testUtil.executeCmd(connTestaccount, createViewV1, callback);
        },
        function (callback)
        {
          testUtil.executeCmd(connTestaccount, createViewV2, callback);
        },
        function (callback)
        {
          testUtil.executeCmd(connTestaccount, createViewV3, callback);
        },
        function (callback)
        {
          testUtil.executeCmd(connTestaccount, createViewV4, callback);
        },
        function (callback)
        {
          testUtil.executeCmd(connTestaccount, createStage, callback);
        },
        function (callback)
        {
          testUtil.executeCmd(connTestaccount, createFileFormat, callback);
        },
        function (callback)
        {
          testUtil.executeCmd(connTestaccount, createSequence, callback);
        },
        function (callback)
        {
          testUtil.executeCmd(connTestaccount, createSqlUdfAdd1Number, callback);
        },
        function (callback)
        {
          testUtil.executeCmd(connTestaccount, createSqlUdfAdd1String, callback);
        },
        function (callback)
        {
          testUtil.executeCmd(connTestaccount, createJsUdfAdd1Double, callback);
        },
        function (callback)
        {
          testUtil.connect(connSnowflake, callback);
        }],
      done
    );
  });

  // clean up
  after(function (done)
  {
    async.series([
        function (callback)
        {
          testUtil.executeCmd(connTestaccount, dropDatabase, callback);
        },
        function (callback)
        {
          testUtil.destroyConnection(connTestaccount, callback);
        },
        function (callback)
        {
          testUtil.destroyConnection(connSnowflake, callback);
        }],
      done
    );
  });

  it('desc database', function (done)
  {
    testGetObjectsOnStmt(
      {
        connTestaccount: connTestaccount,
        connSnowflake: connSnowflake,
        sql: 'desc database node_testdb;',
        output:
          {
            "DATABASE": [
              "S3TESTACCOUNT.NODE_TESTDB"
            ]
          },
        callback: done
      });
  });

  it('desc schema', function (done)
  {
    testGetObjectsOnStmt(
      {
        connTestaccount: connTestaccount,
        connSnowflake: connSnowflake,
        sql: 'desc schema node_testschema;',
        output:
          {
            "SCHEMA": [
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA"
            ]
          },
        callback: done
      });
  });

  it('desc table', function (done)
  {
    testGetObjectsOnStmt(
      {
        connTestaccount: connTestaccount,
        connSnowflake: connSnowflake,
        sql: 'desc table t1;',
        output:
          {
            "TABLE": [
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.T1"
            ]
          },
        callback: done
      });
  });

  it('desc view', function (done)
  {
    testGetObjectsOnStmt(
      {
        connTestaccount: connTestaccount,
        connSnowflake: connSnowflake,
        sql: 'desc view v1;',
        output:
          {
            "VIEW": [
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.V1"
            ]
          },
        callback: done
      });
  });

  it('desc stage', function (done)
  {
    testGetObjectsOnStmt(
      {
        connTestaccount: connTestaccount,
        connSnowflake: connSnowflake,
        sql: 'desc stage test_stage;',
        output:
          {
            "STAGE": [
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.TEST_STAGE"
            ]
          },
        callback: done
      });
  });

  it('desc file format', function (done)
  {
    testGetObjectsOnStmt(
      {
        connTestaccount: connTestaccount,
        connSnowflake: connSnowflake,
        sql: 'desc file format test_file_format;',
        output:
          {
            "FILE_FORMAT": [
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.TEST_FILE_FORMAT"
            ]
          },
        callback: done
      });
  });

  it('desc sequence', function (done)
  {
    testGetObjectsOnStmt(
      {
        connTestaccount: connTestaccount,
        connSnowflake: connSnowflake,
        sql: 'desc sequence test_sequence;',
        output:
          {
            "SEQUENCE": [
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.TEST_SEQUENCE"
            ]
          },
        callback: done
      });
  });

  it('desc function add1(number)', function (done)
  {
    testGetObjectsOnStmt(
      {
        connTestaccount: connTestaccount,
        connSnowflake: connSnowflake,
        sql: 'desc function add1(number);',
        output:
          {
            "FUNCTION": [
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.ADD1"
            ]
          },
        callback: done
      });
  });

  it('desc function add1(string)', function (done)
  {
    testGetObjectsOnStmt(
      {
        connTestaccount: connTestaccount,
        connSnowflake: connSnowflake,
        sql: 'desc function add1(string);',
        output:
          {
            "FUNCTION": [
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.ADD1"
            ]
          },
        callback: done
      });
  });

  it('desc function add1(double)', function (done)
  {
    testGetObjectsOnStmt(
      {
        connTestaccount: connTestaccount,
        connSnowflake: connSnowflake,
        sql: 'desc function add1(double);',
        output:
          {
            "FUNCTION": [
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.ADD1"
            ]
          },
        callback: done
      });
  });

  it('select from table', function (done)
  {
    testGetObjectsOnStmt(
      {
        connTestaccount: connTestaccount,
        connSnowflake: connSnowflake,
        sql: 'select count(*) from t1;',
        output:
          {
            "TABLE": [
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.T1"
            ]
          },
        callback: done
      });
  });

  it('select from view on top of table', function (done)
  {
    testGetObjectsOnStmt(
      {
        connTestaccount: connTestaccount,
        connSnowflake: connSnowflake,
        sql: 'select count(*) from v1;',
        output:
          {
            "TABLE": [
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.T1"
            ],
            "VIEW": [
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.V1"
            ]
          },
        callback: done
      });
  });

  it('select from view on top of view', function (done)
  {
    testGetObjectsOnStmt(
      {
        connTestaccount: connTestaccount,
        connSnowflake: connSnowflake,
        sql: 'select count(*) from v3;',
        output:
          {
            "TABLE": [
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.T1",
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.T2"
            ],
            "VIEW": [
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.V2",
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.V3",
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.V1"
            ]
          },
        callback: done
      });
  });

  it('select from view on top of view on top of view', function (done)
  {
    testGetObjectsOnStmt(
      {
        connTestaccount: connTestaccount,
        connSnowflake: connSnowflake,
        sql: 'select count(*) from v4;',
        output:
          {
            "TABLE": [
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.T1",
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.T2"
            ],
            "VIEW": [
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.V2",
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.V3",
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.V1",
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.V4"
            ]
          },
        callback: done
      });
  });

  it('select from tables and views', function (done)
  {
    testGetObjectsOnStmt(
      {
        connTestaccount: connTestaccount,
        connSnowflake: connSnowflake,
        sql: 'select t1.c1 from t1, t2, v1, v2 where t1.c1 = t2.c1;',
        output:
          {
            "TABLE": [
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.T1",
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.T2"
            ],
            "VIEW": [
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.V2",
              "S3TESTACCOUNT.NODE_TESTDB.NODE_TESTSCHEMA.V1"
            ]
          },
        callback: done
      });
  });
});

/**
 * Runs a query from testaccount, gets its query id and verifies that executing
 * system$get_objects('execute [query_id];') from the snowflake account produces
 * the desired output.
 *
 * @param {Object} options
 */
function testGetObjectsOnStmt(options)
{
  var connTestaccount = options.connTestaccount;
  var connSnowflake = options.connSnowflake;
  var sql = options.sql;
  var output = options.output;

  var queryId;

  /**
   * Builds the SQL text for a system$get_objects('execute [query_id];')
   * statement.
   *
   * @param {String} queryId
   *
   * @returns {String}
   */
  function buildSqlSystem$GetObjects(queryId)
  {
    return util.format('select system$get_objects(%s)',
      util.format("'execute \\'%s\\';'", queryId));
  }

  async.series([
      function (callback)
      {
        // execute a statement and get its query id
        connTestaccount.execute(
          {
            sqlText: sql,
            complete: function (err, statement, rows)
            {
              assert.ok(!err);
              queryId = statement.getQueryId();
              callback();
            }
          });
      },
      function (callback)
      {
        // run system$get_objects('execute [query_id];') from the snowflake
        // account and verify that we get the desired output
        var columnName = "map";
        var sqlText = util.format('%s as "%s";',
          buildSqlSystem$GetObjects(queryId), columnName);
        connSnowflake.execute(
          {
            sqlText: sqlText,
            complete: function (err, statement, rows)
            {
              assert.ok(!err);
              assert.ok(rows && (rows.length === 1));
              assert.deepStrictEqual(JSON.parse(rows[0][columnName]), output);
              callback();
            }
          });
      }
    ],
    options.callback);
}