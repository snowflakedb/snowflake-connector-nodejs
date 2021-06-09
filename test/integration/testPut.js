/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const connOption = require('./connectionOptions');
const fileCompressionType = require('./../../lib/file_transfer_agent/file_compression_type');
const fs = require('fs');
const os = require('os');
const snowflake = require('./../../lib/snowflake');
const tmp = require('tmp');

const TEMP_WAREHOUSE_NAME = 'nodejs_tmp_warehouse';
const TEMP_DATABASE_NAME = 'nodejs_tmp_database';
const TEMP_SCHEMA_NAME = 'nodejs_tmp_schema';
const TEMP_FILEFORMAT_NAME = 'VSV';
const TEMP_TABLE_NAME = 'nodejs_put_table';

const SUCCESS = 'success';
const LOADED = 'LOADED';
const UPLOADED = 'UPLOADED';

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

/* Sets up the environment for put command tests:
 * 1. Set CLIENT_SESSION_KEEP_ALIVE to FALSE
 * 2. Create temp warehouse
 * 3. Create temp database
 * 4. Create temp schema
 * 5. Create temp file format
 */
function setup(connection, done)
{
  var statement = connection.execute({
    sqlText: 'ALTER SESSION SET CLIENT_SESSION_KEEP_ALIVE = FALSE;',
    complete: function (err, stmt, rows)
    {
      var stream = statement.streamRows();
      stream.on('error', function (err)
      {
        done(err);
      });
      stream.on('data', function (row)
      {
        assert.ok(row['status'].includes(SUCCESS));
      });
      stream.on('end', function (row)
      {
        createWarehouse(connection, done);
      });
    }
  });
}

function createWarehouse(connection, done)
{
  var statement = connection.execute({
    sqlText: `create or replace warehouse ${TEMP_WAREHOUSE_NAME} warehouse_size = 'small' warehouse_type='standard' auto_suspend=1800`,
    complete: function (err, stmt, rows)
    {
      var stream = statement.streamRows();
      stream.on('error', function (err)
      {
        done(err);
      });
      stream.on('data', function (row)
      {
        assert.ok(row['status'].includes(SUCCESS));
      });
      stream.on('end', function (row)
      {
        createDatabase(connection, done);
      });
    }
  });
};

function createDatabase(connection, done)
{
  var statement = connection.execute({
    sqlText: `create or replace database ${TEMP_DATABASE_NAME}`,
    complete: function (err, stmt, rows)
    {
      var stream = statement.streamRows();
      stream.on('error', function (err)
      {
        done(err);
      });
      stream.on('data', function (row)
      {
        assert.ok(row['status'].includes(SUCCESS));
      });
      stream.on('end', function (row)
      {
        createSchema(connection, done);
      });
    }
  });
};

function createSchema(connection, done)
{
  var statement = connection.execute({
    sqlText: `create or replace schema ${TEMP_SCHEMA_NAME}`,
    complete: function (err, stmt, rows)
    {
      var stream = statement.streamRows();
      stream.on('error', function (err)
      {
        done(err);
      });
      stream.on('data', function (row)
      {
        assert.ok(row['status'].includes(SUCCESS));
      });
      stream.on('end', function (row)
      {
        createFileFormat(connection, done);
      });
    }
  });
};

function createFileFormat(connection, done)
{
  var statement = connection.execute({
    sqlText: `create or replace file format ${TEMP_FILEFORMAT_NAME} type = 'CSV' field_delimiter='|' error_on_column_count_mismatch=false`,
    complete: function (err, stmt, rows)
    {
      var stream = statement.streamRows();
      stream.on('error', function (err)
      {
        done(err);
      });
      stream.on('data', function (row)
      {
        assert.ok(row['status'].includes(SUCCESS));
      });
      stream.on('end', function (row)
      {
        done();
      });
    }
  });
};

/* Cleans up the environment:
 * 1. Drop the temp warehouse
 * 2. Drop the temp database
 */
function cleanup(connection, done)
{
  dropWarehouse(connection, done);
}

function dropWarehouse(connection, done)
{
  var statement = connection.execute({
    sqlText: `drop warehouse ${TEMP_WAREHOUSE_NAME}`,
    complete: function (err, stmt, rows)
    {
      var stream = statement.streamRows();
      stream.on('data', function (row)
      {
        assert.ok(row['status'].includes(SUCCESS));
      });
      stream.on('end', function (row)
      {
        dropDatabase(connection, done);
      });
    }
  });
};

function dropDatabase(connection, done)
{
  var statement = connection.execute({
    sqlText: `drop database if exists ${TEMP_DATABASE_NAME}`,
    complete: function (err, stmt, rows)
    {
      var stream = statement.streamRows();
      stream.on('data', function (row)
      {
        assert.ok(row['status'].includes(SUCCESS));
      });
      stream.on('end', function (row)
      {
        done();
      });
    }
  });
};

/* Use the temp warehouse, database, and schema then call the specified query:
 * 1. Use the temp warehouse
 * 2. Use the temp database
 * 3. Use the temp schema
 * 4. Call the specified query
 */
function executeQuery(connection, done, query, tmpFile, encoding)
{
  useWarehouse(connection, done, query, tmpFile, encoding);
}

function useWarehouse(connection, done, query, tmpFile, encoding)
{
  var statement = connection.execute({
    sqlText: `use warehouse ${TEMP_WAREHOUSE_NAME}`,
    complete: function (err, stmt, rows)
    {
      var stream = statement.streamRows();
      stream.on('error', function (err)
      {
        done(err);
      });
      stream.on('data', function (row)
      {
        assert.ok(row['status'].includes(SUCCESS));
      });
      stream.on('end', function (row)
      {
        useDatabase(connection, done, query, tmpFile, encoding);
      });
    }
  });
};

function useDatabase(connection, done, query, tmpFile, encoding)
{
  var statement = connection.execute({
    sqlText: `use database ${TEMP_DATABASE_NAME}`,
    complete: function (err, stmt, rows)
    {
      var stream = statement.streamRows();
      stream.on('error', function (err)
      {
        done(err);
      });
      stream.on('data', function (row)
      {
        assert.ok(row['status'].includes(SUCCESS));
      });
      stream.on('end', function (row)
      {
        useSchema(connection, done, query, tmpFile, encoding);
      });
    }
  });
};

function useSchema(connection, done, query, tmpFile, encoding)
{
  var statement = connection.execute({
    sqlText: `use schema ${TEMP_SCHEMA_NAME}`,
    complete: function (err, stmt, rows)
    {
      var stream = statement.streamRows();
      stream.on('error', function (err)
      {
        done(err);
      });
      stream.on('data', function (row)
      {
        assert.ok(row['status'].includes(SUCCESS));
      });
      stream.on('end', function (row)
      {
        query(connection, done, tmpFile, encoding);
      });
    }
  });
};

/* Creates the temp table, uploads file, and copies into the table:
 * 1. Create the temp table
 * 2. Upload the file
 * 3. Copy into the temp table
 * 4. Check the contents are correct
 * 5. Check the row count is correct
 * 7. Remove the files from staging
 */
function uploadFileQuery(connection, done, tmpFile, encoding)
{
  createTable(connection, done, tmpFile, encoding)
}

function createTable(connection, done, tmpFile, encoding)
{
  var statement = connection.execute({
    sqlText: `create or replace table ${TEMP_TABLE_NAME} (${COL1} STRING, ${COL2} STRING, ${COL3} STRING)`,
    complete: function (err, stmt, rows)
    {
      var stream = statement.streamRows();
      stream.on('error', function (err)
      {
        done(err);
      });
      stream.on('data', function (row)
      {
        assert.ok(row['status'].includes(SUCCESS));
      });
      stream.on('end', function (row)
      {
        putFile(connection, done, tmpFile, encoding);
      });
    }
  });
};

function putFile(connection, done, tmpFile, encoding)
{
  var statement = connection.execute({
    sqlText: `PUT file://${tmpFile.name} @${TEMP_DATABASE_NAME}.${TEMP_SCHEMA_NAME}.%${TEMP_TABLE_NAME}`,
    complete: function (err, stmt, rows)
    {
      var stream = statement.streamRows();
      stream.on('error', function (err)
      {
        done(err);
      });
      stream.on('data', function (row)
      {
        // Check the file is correctly uploaded
        assert.strictEqual(row['status'], UPLOADED);
        // Check the target encoding is correct
        assert.strictEqual(row['targetCompression'], encoding);
      });
      stream.on('end', function (row)
      {
        copyInto(connection, done);
      });
    }
  });
};

function copyInto(connection, done)
{
  var statement = connection.execute({
    sqlText: `COPY INTO ${TEMP_TABLE_NAME}`,
    complete: function (err, stmt, rows)
    {
      var stream = statement.streamRows();
      stream.on('error', function (err)
      {
        done(err);
      });
      stream.on('data', function (row)
      {
        assert.strictEqual(row['status'], LOADED);
      });
      stream.on('end', function (row)
      {
        selectQuery(connection, done);
      });
    }
  });
};

function selectQuery(connection, done)
{
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
        selectCount(connection, done);
      });
    }
  });
};

function selectCount(connection, done)
{
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
        removeFiles(connection, done);
      });
    }
  });
};

function removeFiles(connection, done)
{
  var statement = connection.execute({
    sqlText: `REMOVE @${TEMP_DATABASE_NAME}.${TEMP_SCHEMA_NAME}.%${TEMP_TABLE_NAME}`,
    complete: function (err, stmt, rows)
    {
      var stream = statement.streamRows();
      stream.on('error', function (err)
      {
        done(err);
      });
      stream.on('data', function (row)
      {
        // Check the files are properly removed
        assert.strictEqual(row['result'], "removed");
      });
      stream.on('end', function (row)
      {
        done();
      });
    }
  });
};

describe('PUT test', function ()
{
  this.timeout(10000);

  var tmpFile;

  this.beforeEach(function (done)
  {
    var connection = snowflake.createConnection(connOption.valid);
    connection.connect(function (err)
    {
      setup(connection, done);
    });
  });

  this.afterEach(function (done)
  {
    var connection = snowflake.createConnection(connOption.valid);
    connection.connect(function (err)
    {
      cleanup(connection, done);
    });

    fs.closeSync(tmpFile.fd);
    fs.rmSync(tmpFile.name);
  });

  var testCases =
    [
      {
        name: 'S3 upload - gzip',
        encoding: fileCompressionType.lookupByMimeSubType('gzip'),
        connOption: connOption.valid
      },
      {
        name: 'S3 upload - bzip2',
        encoding: fileCompressionType.lookupByMimeSubType('bz2'),
        connOption: connOption.valid
      },
      {
        name: 'S3 upload - brotli',
        encoding: fileCompressionType.lookupByMimeSubType('br'),
        connOption: connOption.valid
      },
      {
        name: 'S3 upload - deflate',
        encoding: fileCompressionType.lookupByMimeSubType('deflate'),
        connOption: connOption.valid
      },
      {
        name: 'S3 upload - raw deflate',
        encoding: fileCompressionType.lookupByMimeSubType('raw_deflate'),
        connOption: connOption.valid
      },
      {
        name: 'S3 upload - zstd',
        encoding: fileCompressionType.lookupByMimeSubType('zstd'),
        connOption: connOption.valid
      }
    ];

  for (var index = 0; index < testCases.length; index++)
  {
    var testCase = testCases[index];
    it(testCase.name, function (done)
    {
      // Create a temp file with specified file extension
      tmpFile = tmp.fileSync({ postfix: testCase.encoding['file_extension'] });
      // Write row data to temp file
      fs.writeFileSync(tmpFile.name, ROW_DATA);

      var connection = snowflake.createConnection(testCase.connOption);
      connection.connect(function (err)
      {
        assert.ok(!err, JSON.stringify(err));

        executeQuery(connection, done, uploadFileQuery, tmpFile, testCase.encoding['name']);
      });
    });
  }
});
