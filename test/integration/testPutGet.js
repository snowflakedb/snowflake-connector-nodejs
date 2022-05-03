/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const async = require('async');
const connOption = require('./connectionOptions');
const fileCompressionType = require('./../../lib/file_transfer_agent/file_compression_type');
const fs = require('fs');
const testUtil = require('./testUtil');
const tmp = require('tmp');
const os = require('os');
const path = require('path');

const DATABASE_NAME = connOption.valid.database;
const SCHEMA_NAME = connOption.valid.schema;
const TEMP_TABLE_NAME = 'TEMP_TABLE';

const SKIPPED = "SKIPPED";
const UPLOADED = "UPLOADED";
const DOWNLOADED = "DOWNLOADED";

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
const ROW_DATA_SIZE = 76;

const ROW_DATA_OVERWRITE = COL3_DATA + "," + COL1_DATA + "," + COL2_DATA + "\n";
const ROW_DATA_OVERWRITE_SIZE = 19;

describe('PUT GET test', function ()
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
    connection = testUtil.createConnection();
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
        name: 'gzip',
        encoding: fileCompressionType.lookupByMimeSubType('gzip'),
      },
      {
        name: 'bzip2',
        encoding: fileCompressionType.lookupByMimeSubType('bz2'),
      },
      {
        name: 'brotli',
        encoding: fileCompressionType.lookupByMimeSubType('br'),
      },
      {
        name: 'deflate',
        encoding: fileCompressionType.lookupByMimeSubType('deflate'),
      },
      {
        name: 'raw deflate',
        encoding: fileCompressionType.lookupByMimeSubType('raw_deflate'),
      },
      {
        name: 'zstd',
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
        // Windows user contains a '~' in the path which causes an error
        if (process.platform == "win32")
        {
          var fileName = tmpFile.name.substring(tmpFile.name.lastIndexOf('\\'));
          putQuery = `PUT file://${process.env.USERPROFILE}\\AppData\\Local\\Temp\\${fileName} @${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME}`;
        }

        // Create a tmp folder for downloaded files
        var tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'get'));
        var fileSize;

        var getQuery = `GET @${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME} file://${tmpDir}`;
        // Windows user contains a '~' in the path which causes an error
        if (process.platform == "win32")
        {
          var dirName = tmpDir.substring(tmpDir.lastIndexOf('\\') + 1);
          getQuery = `GET @${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME} file://${process.env.USERPROFILE}\\AppData\\Local\\Temp\\${dirName}`;
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
                    fileSize = row.targetSize;
                    // Check the file is correctly uploaded
                    assert.strictEqual(row['status'], UPLOADED);
                    // Check the target encoding is correct
                    assert.strictEqual(row['targetCompression'], testCase.encoding['name']);
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
              // Run GET command
              var statement = connection.execute({
                sqlText: getQuery,
                complete: function (err, stmt, rows)
                {
                  var stream = statement.streamRows();
                  stream.on('error', function (err)
                  {
                    done(err);
                  });
                  stream.on('data', function (row)
                  {
                    assert.strictEqual(row.status, DOWNLOADED);
                    assert.strictEqual(row.size, fileSize);
                    // Delete the downloaded file
                    fs.unlink(path.join(tmpDir, row.file), (err) =>
                    {
                      if (err) throw (err);
                      // Delete the temporary folder
                      fs.rmdir(tmpDir, (err) =>
                      {
                        if (err) throw (err);
                      });
                    });
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

//describe('PUT GET overwrite test', function ()
//{
//  this.timeout(100000);

//  var connection;
//  var tmpFile;
//  var createTable = `create or replace table ${TEMP_TABLE_NAME} (${COL1} STRING, ${COL2} STRING, ${COL3} STRING)`;
//  var removeFile = `REMOVE @${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME}`;
//  var dropTable = `DROP TABLE IF EXISTS ${TEMP_TABLE_NAME}`;

//  before(function (done)
//  {
//    connection = testUtil.createConnection();
//    testUtil.connect(connection, done);
//  });

//  after(function (done)
//  {
//    fs.closeSync(tmpFile.fd);
//    fs.unlinkSync(tmpFile.name);

//    // Remove files from staging
//    testUtil.executeCmd(connection, removeFile);

//    // Drop temp table
//    testUtil.executeCmd(connection, dropTable);

//    testUtil.destroyConnection(connection, done);
//  });

//  // Create a temp file with specified file extension
//  var tmpFile = tmp.fileSync();
//  // Write row data to temp file
//  fs.writeFileSync(tmpFile.name, ROW_DATA);

//  var putQuery = `PUT file://${tmpFile.name} @${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME} AUTO_COMPRESS=FALSE`;
//  // Windows user contains a '~' in the path which causes an error
//  if (process.platform == "win32")
//  {
//    var fileName = tmpFile.name.substring(tmpFile.name.lastIndexOf('\\'));
//    putQuery = `PUT file://${process.env.USERPROFILE}\\AppData\\Local\\Temp\\${fileName} @${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME} AUTO_COMPRESS=FALSE`;
//  }

//  var testCases =
//    [
//      {
//        name: 'upload'
//      },
//      {
//        name: 'overwrite - false'
//      },
//      {
//        name: 'overwrite - true'
//      },
//    ];

//  var createItCallback = function (testCase)
//  {
//    return function (done)
//    {
//      {
//        async.series(
//          [
//            function (callback)
//            {
//              // Create temp table
//              testUtil.executeCmd(connection, createTable, callback);
//            },
//            function (callback)
//            {
//              // Upload file
//              if (testCase.name == 'overwrite - true')
//              {
//                fs.writeFileSync(tmpFile.name, ROW_DATA_OVERWRITE);
//                putQuery += " OVERWRITE=TRUE";
//              }

//              var statement = connection.execute({
//                sqlText: putQuery,
//                complete: function (err, stmt, rows)
//                {
//                  var stream = statement.streamRows();
//                  stream.on('error', function (err)
//                  {
//                    done(err);
//                  });
//                  stream.on('data', function (row)
//                  {
//                    if (testCase.name == testCases[0])
//                    {
//                      // Check the file is correctly uploaded
//                      assert.strictEqual(row['status'], UPLOADED);
//                      assert.strictEqual(row.targetSize, ROW_DATA_SIZE);
//                    }
//                    else if (testCase.name ==  testCases[2])
//                    {
//                      // Check the file is correctly uploaded
//                      assert.strictEqual(row['status'], UPLOADED);
//                      assert.strictEqual(row.targetSize, ROW_DATA_OVERWRITE_SIZE);
//                    }
//                  });
//                  stream.on('end', function (row)
//                  {
//                    callback();
//                  });
//                }
//              });
//            }
//          ],
//          done
//        );
//      };
//    };
//  };

//  for (var index = 0; index < testCases.length; index++)
//  {
//    var testCase = testCases[index];
//    it(testCase.name, createItCallback(testCase));
//  }
//});
