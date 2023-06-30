/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

var assert = require('assert');
var async = require('async');
var connOption = require('./connectionOptions').valid;
var testUtil = require('./testUtil');
var fs = require('fs');
var tmp = require('tmp');

describe('Execute test', function ()
{
  var connection;
  var createNodeTSQL = 'create or replace table NodeT(colA number, colB varchar)';
  var selectAllSQL = 'select * from NodeT';
  var insertNodeTSQL = 'insert into NodeT values(1, \'a\')';
  var updateNodeTSQL = 'update NodeT set COLA = 2, COLB = \'b\' where COLA = 1';
  var dropNodeTSQL = 'drop table if exists NodeT';

  before(function (done)
  {
    connection = testUtil.createConnection();
    async.series([
        function (callback)
        {
          testUtil.connect(connection, callback);
        }],
      done
    );
  });

  after(function (done)
  {
    async.series([
        function (callback)
        {
          testUtil.destroyConnection(connection, callback);
        }],
      done
    );
  });

  it('testSimpleInsert', function (done)
  {
    async.series(
      [
        function (callback)
        {
          testUtil.executeCmd(connection, createNodeTSQL, callback);
        },
        function (callback)
        {
          var insertCount = 5;
          var insertValues = function (i)
          {
            if (i < insertCount)
            {
              testUtil.executeCmd(connection,
                insertNodeTSQL,
                function ()
                {
                  insertValues(i + 1);
                });
            }
            else
            {
              callback();
            }
          };
          insertValues(0);
        },
        function (callback)
        {
          testUtil.executeQueryAndVerify(
            connection,
            selectAllSQL,
            [{'COLA': 1, 'COLB': 'a'},
              {'COLA': 1, 'COLB': 'a'},
              {'COLA': 1, 'COLB': 'a'},
              {'COLA': 1, 'COLB': 'a'},
              {'COLA': 1, 'COLB': 'a'}],
            callback
          );
        },
        function (callback)
        {
          testUtil.executeCmd(
            connection,
            dropNodeTSQL,
            callback
          );
        }],
      done
    );
  });

  it('testSimpleUpdate', function (done)
  {
    async.series([
        function (callback)
        {
          testUtil.executeCmd(connection, createNodeTSQL, callback);
        },
        function (callback)
        {
          testUtil.executeCmd(connection, insertNodeTSQL, callback);
        },
        function (callback)
        {
          testUtil.executeCmd(connection, updateNodeTSQL, callback);
        },
        function (callback)
        {
          testUtil.executeQueryAndVerify(
            connection,
            selectAllSQL,
            [{'COLA': 2, 'COLB': 'b'}],
            callback
          );
        },
        function (callback)
        {
          testUtil.executeCmd(
            connection,
            dropNodeTSQL,
            callback
          );
        }],
      done
    );
  });

  it('testDDLResultSet', function (done)
  {
    async.series(
      [
        function (callback)
        {
          testUtil.executeQueryAndVerify(
            connection,
            createNodeTSQL,
            [{'status': 'Table NODET successfully created.'}],
            callback
          );
        },
        function (callback)
        {
          testUtil.executeQueryAndVerify(
            connection,
            insertNodeTSQL,
            [{'number of rows inserted': 1}],
            callback
          );
        },
        function (callback)
        {
          testUtil.executeCmd(connection, dropNodeTSQL, callback);
        }
      ],
      done
    );
  });
});

describe('Execute test - variant', function ()
{
  this.timeout(100000);

  var connection;

  const DATABASE_NAME = connOption.database;
  const SCHEMA_NAME = connOption.schema;

  const TEST_VARIANT_TABLE = "TEST_VARIANT_TABLE";
  const TEST_VARIANT_STAGE = "TEST_VARIANT_STAGE";
  const TEST_VARIANT_FORMAT = "TEST_VARIANT_FORMAT";
  const TEST_COL = "COL";
  const TEST_HEADER = "ROOT";
  const TEST_XML_VAL = 123;
  const TEST_JSON_VAL = "<123>";

  const createTableVariant = `create or replace table ${TEST_VARIANT_TABLE}(${TEST_COL} variant)`;
  const createStageVariant = `CREATE OR REPLACE STAGE ${TEST_VARIANT_STAGE} FILE_FORMAT = ${TEST_VARIANT_FORMAT}`;
  const copyIntoVariant = `COPY INTO ${TEST_VARIANT_TABLE} FROM @${DATABASE_NAME}.${SCHEMA_NAME}.${TEST_VARIANT_STAGE}`;
  const selectVariant = `select ${TEST_COL} from ${TEST_VARIANT_TABLE}`;
  const dropStageVariant = `drop table if exists ${TEST_VARIANT_STAGE}`;
  const dropTableVariant = `drop table if exists ${TEST_VARIANT_TABLE}`;

  before(function (done)
  {
    connection = testUtil.createConnection();
    async.series([
        function (callback)
        {
          testUtil.connect(connection, callback);
        }],
      done
    );
  });

  after(function (done)
  {
    async.series([
        function (callback)
        {
          testUtil.destroyConnection(connection, callback);
        }],
      done
    );
  });

  var testCases =
    [
      {
        name: 'raw xml',
        type: 'XML',
        fileExtension: '.xml',
      },
      {
        name: 'raw json',
        type: 'JSON',
        fileExtension: '.json',
      }
    ];

  var createItCallback = function (testCase)
  {
    return function (done)
    {
      {
        var createFileFormatVariant = `CREATE OR REPLACE FILE FORMAT ${TEST_VARIANT_FORMAT} TYPE = ${testCase.type}`;

        var sampleData;
        if (testCase.type == 'XML')
        {
          sampleData = `<${TEST_HEADER}>${TEST_XML_VAL}</${TEST_HEADER}>`;
        }
        else if (testCase.type == 'JSON')
        {
          sampleData = `{${TEST_HEADER}: \"${TEST_JSON_VAL}\"}`;
        }

        var sampleTempFile = tmp.fileSync({ postfix: testCase.fileExtension });
        fs.writeFileSync(sampleTempFile.name, sampleData);

        var putVariant = `PUT file://${sampleTempFile.name} @${DATABASE_NAME}.${SCHEMA_NAME}.${TEST_VARIANT_STAGE}`;

        // Windows user contains a '~' in the path which causes an error
        if (process.platform == "win32")
        {
          var fileName = sampleTempFile.name.substring(sampleTempFile.name.lastIndexOf('\\'));
          putVariant = `PUT file://${process.env.USERPROFILE}\\AppData\\Local\\Temp\\${fileName} @${DATABASE_NAME}.${SCHEMA_NAME}.${TEST_VARIANT_STAGE}`;
        }

        async.series(
          [
            function (callback)
            {
              // Create variant table
              testUtil.executeCmd(connection, createTableVariant, callback);
            },
            function (callback)
            {
              // Create variant file format
              testUtil.executeCmd(connection, createFileFormatVariant, callback);
            },
            function (callback)
            {
              // Create stage with variant file format
              testUtil.executeCmd(connection, createStageVariant, callback);
            },
            function (callback)
            {
              // Upload sample file
              testUtil.executeCmd(connection, putVariant, callback);
            },
            function (callback)
            {
              // Load sample file
              testUtil.executeCmd(connection, copyIntoVariant, callback);
            },
            function (callback)
            {
              // Select values from table
              connection.execute({
                sqlText: selectVariant,
                complete: function (err, stmt, rows)
                {
                  var stream = stmt.streamRows();
                  stream.on('error', function (err)
                  {
                    done(err);
                  });
                  stream.on('data', function (row)
                  {
                    // Check the column, header, and value is correct
                    if (testCase.type == 'XML')
                    {
                      assert.strictEqual(row[TEST_COL][TEST_HEADER], TEST_XML_VAL);
                    }
                    else if (testCase.type == 'JSON')
                    {
                      assert.strictEqual(row[TEST_COL][TEST_HEADER], TEST_JSON_VAL);
                    }
                  });
                  stream.on('end', function ()
                  {
                    callback();
                  });
                }
              });
            },
            function (callback)
            {
              // Drop stage
              testUtil.executeCmd(connection, dropStageVariant, callback);
            },
            function (callback)
            {
              // Drop table
              testUtil.executeCmd(connection, dropTableVariant, callback);
            },
            function (callback)
            {
              // Delete temp files
              fs.closeSync(sampleTempFile.fd);
              fs.unlinkSync(sampleTempFile.name);
              callback();
            }],
          done
        );
      };
    };
  };

  for (var index = 0; index < testCases.length; index++)
  {
    var testCase = testCases[index];
    it(testCase.name, createItCallback(testCase));
  }
});

describe('Execute test with Pool', function ()
{
  var connectionPool;
  var createNodeTSQL = 'create or replace table NodeT(colA number, colB varchar)';
  var selectAllSQL = 'select * from NodeT';
  var insertNodeTSQL = 'insert into NodeT values(1, \'a\')';
  var updateNodeTSQL = 'update NodeT set COLA = 2, COLB = \'b\' where COLA = 1';
  var dropNodeTSQL = 'drop table if exists NodeT';

  before(function (done)
  {
    connectionPool = testUtil.createConnectionPool();
    done();
  });

  it('testSimpleInsert', function (done)
  {
    async.series(
      [
        function (callback)
        {
          testUtil.executeCmdUsePool(connectionPool, createNodeTSQL, callback);
        },
        function (callback)
        {
          var insertCount = 5;
          var insertValues = function (i)
          {
            if (i < insertCount)
            {
              testUtil.executeCmdUsePool(connectionPool,
                insertNodeTSQL,
                function ()
                {
                  insertValues(i + 1);
                });
            }
            else
            {
              callback();
            }
          };
          insertValues(0);
        },
        function (callback)
        {
          testUtil.executeQueryAndVerifyUsePool(
            connectionPool,
            selectAllSQL,
            [{'COLA': 1, 'COLB': 'a'},
              {'COLA': 1, 'COLB': 'a'},
              {'COLA': 1, 'COLB': 'a'},
              {'COLA': 1, 'COLB': 'a'},
              {'COLA': 1, 'COLB': 'a'}],
            callback
          );
        },
        function (callback)
        {
          testUtil.executeCmdUsePool(
            connectionPool,
            dropNodeTSQL,
            callback
          );
        }
      ],
      done
    );
  });

  it('testSimpleUpdate', function (done)
  {
    async.series([
        function (callback)
        {
          testUtil.executeCmdUsePool(connectionPool, createNodeTSQL, callback);
        },
        function (callback)
        {
          testUtil.executeCmdUsePool(connectionPool, insertNodeTSQL, callback);
        },
        function (callback)
        {
          testUtil.executeCmdUsePool(connectionPool, updateNodeTSQL, callback);
        },
        function (callback)
        {
          testUtil.executeQueryAndVerifyUsePool(
            connectionPool,
            selectAllSQL,
            [{'COLA': 2, 'COLB': 'b'}],
            callback
          );
        },
        function (callback)
        {
          testUtil.executeCmdUsePool(
            connectionPool,
            dropNodeTSQL,
            callback
          );
        }],
      done
    );
  });

  it('testDDLResultSet', function (done)
  {
    async.series(
      [
        function (callback)
        {
          testUtil.executeQueryAndVerifyUsePool(
            connectionPool,
            createNodeTSQL,
            [{'status': 'Table NODET successfully created.'}],
            callback
          );
        },
        function (callback)
        {
          testUtil.executeQueryAndVerifyUsePool(
            connectionPool,
            insertNodeTSQL,
            [{'number of rows inserted': 1}],
            callback
          );
        },
        function (callback)
        {
          testUtil.executeCmdUsePool(connectionPool, dropNodeTSQL, callback);
        }
      ],
      done
    );
  });
});