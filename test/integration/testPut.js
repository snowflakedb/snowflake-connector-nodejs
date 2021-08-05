/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

var snowflake = require('./../../lib/snowflake');
const assert = require('assert');
const async = require('async');
const connOption = require('./connectionOptions');
const fileCompressionType = require('./../../lib/file_transfer_agent/file_compression_type');
const fs = require('fs');
const testUtil = require('./testUtil');
const tmp = require('tmp');

const DATABASE_NAME = connOption.validS3.database;
const SCHEMA_NAME = connOption.validS3.schema;
const TEMP_TABLE_NAME = 'TEMP_TABLE';

const UPLOADED = "UPLOADED";

const COL1 = 'C1';
const COL2 = 'C2';
const COL3 = 'C3';
const COL1_DATA = 'FIRST';
const COL2_DATA = 'SECOND';
const COL3_DATA = 'THIRD';
const ROW_DATA =
  COL1_DATA + "," + COL2_DATA + "," + COL3_DATA + "\n" +
  COL1_DATA + "," + COL2_DATA + "," + COL3_DATA + "\n" +
  COL1_DATA + "," + COL2_DATA + "," + COL3_DATA + "\n" +
  COL1_DATA + "," + COL2_DATA + "," + COL3_DATA + "\n";

describe('PUT test', function ()
{
  this.timeout(100000);

  var connection;
  var tmpFile;
  var createTable = `create or replace table ${TEMP_TABLE_NAME} (${COL1} STRING, ${COL2} STRING, ${COL3} STRING)`;
  var copyInto = `COPY INTO ${TEMP_TABLE_NAME}`;
  var removeFile = `REMOVE @${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME}`;
  var dropTable = `DROP TABLE IF EXISTS ${TEMP_TABLE_NAME}`;

  before(function (done)
  {
    console.log("testPutDebug SNOWFLAKE_TEST_ACCOUNT: " + process.env.SNOWFLAKE_TEST_ACCOUNT);
    console.log("testPutDebug SNOWFLAKE_S3_TEST_ACCOUNT: " + process.env.SNOWFLAKE_S3_TEST_ACCOUNT);
    console.log("testPutDebug connOption.validS3 account: " + connOption.validS3.account);
    console.log("testPutDebug connOption.validS3 username: " + connOption.validS3.username);
    console.log("testPutDebug connOption.validS3 accessUrl: " + connOption.validS3.accessUrl);
    connection = snowflake.createConnection(connOption.validS3);
    testUtil.connect(connection, done);
  });

  after(function (done)
  {
    testUtil.destroyConnection(connection, done);
  });

  afterEach(function ()
  {
    fs.closeSync(tmpFile.fd);
    fs.unlinkSync(tmpFile.name);
  });

  var testCases =
    [
      {
        name: 'PUT command - gzip',
        encoding: fileCompressionType.lookupByMimeSubType('gzip'),
      },
      {
        name: 'PUT command - bzip2',
        encoding: fileCompressionType.lookupByMimeSubType('bz2'),
      },
      {
        name: 'PUT command - brotli',
        encoding: fileCompressionType.lookupByMimeSubType('br'),
      },
      {
        name: 'PUT command - deflate',
        encoding: fileCompressionType.lookupByMimeSubType('deflate'),
      },
      {
        name: 'PUT command - raw deflate',
        encoding: fileCompressionType.lookupByMimeSubType('raw_deflate'),
      },
      {
        name: 'PUT command - zstd',
        encoding: fileCompressionType.lookupByMimeSubType('zstd'),
      }
    ];

  var createItCallback = function (testCase)
  {
    return function (done)
    {
      {
        // Create a temp file with specified file extension
        tmpFile = tmp.fileSync({ postfix: testCase.encoding['file_extension'] });
        // Write row data to temp file
        fs.writeFileSync(tmpFile.name, ROW_DATA);

        var putQuery = `PUT file://${tmpFile.name} @${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME}`;
        console.log("testPutDebug PUT query: " + putQuery);

        // Windows user contains a '~' in the path which causes an error
        if (process.platform == "win32")
        {
          var fileName = tmpFile.name.substring(tmpFile.name.lastIndexOf('\\'));
          putQuery = `PUT file://${process.env.USERPROFILE}\\AppData\\Local\\Temp\\${fileName} @${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME}`;
        }

        async.series(
          [
            function (callback)
            {
              // Create temp table
              testUtil.executeCmd(connection, createTable, callback);
            },
            function (callback)
            {
              // Upload file
              console.log("testPutDebug PUT command start");

              var statement = connection.execute({
                sqlText: putQuery,
                complete: function (err, stmt, rows)
                {
                  var stream = statement.streamRows();
                  stream.on('error', function (err)
                  {
                    done(err);
                  });
                  stream.on('data', function (row)
                  {
                    console.log("testPutDebug row['message']: " + row['message']);

                    // Check the file is correctly uploaded
                    assert.strictEqual(row['status'], UPLOADED);
                    // Check the target encoding is correct
                    assert.strictEqual(row['targetCompression'], testCase.encoding['name']);
                  });
                  stream.on('end', function (row)
                  {
                    console.log("testPutDebug PUT command end");
                    callback();
                  });
                }
              });
            },
            function (callback)
            {
              // Copy into temp table
              testUtil.executeCmd(connection, copyInto, callback);
            },
            function (callback)
            {
              // Check the contents are correct
              var statement = connection.execute({
                sqlText: `SELECT * FROM ${TEMP_TABLE_NAME}`,
                complete: function (err, stmt, rows)
                {
                  var stream = statement.streamRows();
                  stream.on('error', function (err)
                  {
                    done(err);
                  });
                  stream.on('data', function (row)
                  {
                    // Check the row data is correct
                    assert.strictEqual(row[COL1], COL1_DATA);
                    assert.strictEqual(row[COL2], COL2_DATA);
                    assert.strictEqual(row[COL3], COL3_DATA);
                  });
                  stream.on('end', function (row)
                  {
                    callback()
                  });
                }
              });
            },
            function (callback)
            {
              // Check the row count is correct
              var statement = connection.execute({
                sqlText: `SELECT COUNT(*) FROM ${TEMP_TABLE_NAME}`,
                complete: function (err, stmt, rows)
                {
                  var stream = statement.streamRows();
                  stream.on('error', function (err)
                  {
                    done(err);
                  });
                  stream.on('data', function (row)
                  {
                    // Check the row count is correct
                    assert.strictEqual(row['COUNT(*)'], 4);
                  });
                  stream.on('end', function (row)
                  {
                    callback();
                  });
                }
              });
            },
            function (callback)
            {
              // Remove files from staging
              testUtil.executeCmd(connection, removeFile, callback);
            },
            function (callback)
            {
              // Drop temp table
              testUtil.executeCmd(connection, dropTable, callback);
            }
          ],
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
