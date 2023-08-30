/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
const assert = require('assert');
const async = require('async');
const testUtil = require('./testUtil');
const { configureLogger } = require('../configureLogger');

describe('Large result Set Tests', function ()
{
  const sourceRowCount = 10000;

  let connection;
  const selectAllFromOrders = `select randstr(1000,random()) from table(generator(rowcount=>${sourceRowCount}))`;

  before(async () =>
  {
    connection = testUtil.createConnection();
    await testUtil.connectAsync(connection);
  });

  after(async () =>
  {
    await testUtil.destroyConnectionAsync(connection);
  });

  it('testSimpleLarge', function (done)
  {
    connection.execute({
      sqlText: selectAllFromOrders,
      complete: function (err, stmt)
      {
        testUtil.checkError(err);
        var stream = stmt.streamRows();
        var rowCount = 0;
        stream.on('data', function ()
        {
          rowCount++;
        });
        stream.on('error', function (err)
        {
          testUtil.checkError(err);
        });
        stream.on('end', function ()
        {
          assert.strictEqual(rowCount, sourceRowCount);
          done();
        });
      }
    });
  });

  it('testStartIndexInFirstChunk', function (done)
  {
    const offset = 10;
    connection.execute({
      sqlText: selectAllFromOrders,
      complete: function (err, stmt)
      {
        testUtil.checkError(err);
        var rowCount = 0;
        var stream = stmt.streamRows({
          start: offset
        });
        stream.on('data', function ()
        {
          rowCount++;
        });
        stream.on('error', function (err)
        {
          testUtil.checkError(err);
        });
        stream.on('end', function ()
        {
          assert.strictEqual(rowCount, sourceRowCount - offset);
          done();
        });
      }
    });
  });

  it('testStartIndexNotInFirstChunk', function (done)
  {
    const offset = 5000;
    connection.execute({
      sqlText: selectAllFromOrders,
      complete: function (err, stmt)
      {
        testUtil.checkError(err);
        var rowCount = 0;
        var stream = stmt.streamRows({
          start: offset
        });
        stream.on('data', function ()
        {
          rowCount++;
        });
        stream.on('error', function (err)
        {
          testUtil.checkError(err);
        });
        stream.on('end', function ()
        {
          assert.strictEqual(rowCount, sourceRowCount - offset);
          done();
        })
      }
    });
  });

  describe('Large Result Set Tests For Variant Column Type', function ()
  {
    const createTempTable = 'create or replace table testVariantTemp(value string)';
    const createTableWithVariant = 'create or replace table testVariantTable(colA variant)';
    const dropTableWithVariant = 'drop table if exists testVariantTable';
    const dropTempTable = 'drop table if exists testVariantTemp';

    before(async () =>
    {
      await testUtil.executeCmdAsync(connection, createTableWithVariant);
      await testUtil.executeCmdAsync(connection, createTempTable);
    });

    after(async () =>
    {
      await testUtil.executeCmdAsync(connection, dropTableWithVariant);
      await testUtil.executeCmdAsync(connection, dropTempTable);
    });

    it('testSelectOnVariantColumnForLargeResultSets', function (done)
    {
      const insertTemp = 'insert into testVariantTemp values (?)';
      const insertVariant = 'insert into testVariantTable select parse_json(value) from testVariantTemp';
      const selectVariant = 'select * from testVariantTable';

      const arrJSON = [];
      for (let i = 0; i < sourceRowCount; i++)
      {
        const sampleJSON = {
          "root":
          {
            "key":
              [
                {
                  "key1": i,
                  "key2": "value2",
                  "key3": "value3",
                  "key4": "value4",
                  "key5":
                  {
                    "key":
                      [
                        { "key1": "value1", "key2": "value2" },
                        { "key1": "value1", "key2": "value2" },
                        { "key1": "value1", "key2": "value2" },
                        { "key1": "value1", "key2": "value2" }
                      ]
                  },
                  "key6":
                    [
                      { "key1": "value1", "key": "value" },
                      { "key1": "value1", "key": "value" },
                      { "key1": "value1", "key": "value" },
                      { "key1": "value1", "key": "value" },
                      { "key1": "value1", "key": "value" },
                      { "key1": "value1", "key": "value" },
                      { "key1": "value1", "key": "value" }
                    ]
                },
              ]
          }
        };
        arrJSON.push([JSON.stringify(sampleJSON)]);
      }

      async.series([
        function (callback)
        {
          connection.execute({
            sqlText: insertTemp,
            binds: arrJSON,
            complete: function (err, stmt)
            {
              if (err)
              {
                callback(err);
              }
              else
              {
                try
                {
                  assert.strictEqual(stmt.getNumUpdatedRows(), sourceRowCount);
                  callback();
                }
                catch (err)
                {
                  callback(err);
                }
              }
            }
          });
        },
        function (callback)
        {
          connection.execute({
            sqlText: insertVariant,
            complete: (err) => callback(err)
          })
        },
        function (callback)
        {
          connection.execute({
            sqlText: selectVariant,
            streamResult: true,
            complete: function (err, stmt)
            {
              if (err)
              {
                callback(err);
              }
              else
              {
                var stream = stmt.streamRows();
                var rowCount = 0;
                stream.on('data', function ()
                {
                  rowCount++;
                });
                stream.on('error', function (err)
                {
                  callback(err);
                });
                stream.on('end', function ()
                {
                  try
                  {
                    assert.strictEqual(rowCount, sourceRowCount);
                    callback();
                  }
                  catch (err)
                  {
                    callback(err);
                  }
                });
              }
            }
          });
        }],
        done
      );
    });
  });
});

describe('SNOW-743920: Large result set with ~35 chunks', function () {
  let connection;
  const tableName = 'test_table';
  const sourceRowCount = 251002;
  const generatedRowSize = 350;
  const createTable = `create or replace table ${tableName} (data string)`;
  const populateData = `insert into ${tableName} select randstr(${generatedRowSize}, random()) from table (generator(rowcount =>${sourceRowCount}))`;
  const selectData = `select * from ${tableName}`;

  before(async () => {
    connection = testUtil.createConnection();
    await testUtil.connectAsync(connection);
    // setting ROWS_PER_RESULTSET causes invalid, not encoded chunks from GCP
    // await testUtil.executeCmdAsync(connection, 'alter session set ROWS_PER_RESULTSET = 1000000');
    await testUtil.executeCmdAsync(connection, 'alter session set USE_CACHED_RESULT = false;');
    await testUtil.executeCmdAsync(connection, createTable);
    await testUtil.executeCmdAsync(connection, populateData);
    configureLogger('TRACE');
  });

  after(async () => {
    configureLogger('ERROR');
    await testUtil.dropTablesIgnoringErrorsAsync(connection, [tableName]);
    await testUtil.destroyConnectionAsync(connection);
  });

  it('fetch result set with many chunks without streaming', done => {
    connection.execute({
      sqlText: selectData,
      complete: function (err, _, rows) {
        if (err) {
          done(err);
        } else {
          try {
            testUtil.checkError(err);
            assert.strictEqual(rows.length, sourceRowCount);
            done();
          } catch (e) {
            done(e);
          }
        }
      }
    });
  });

  it('fetch result set with many chunks with streaming', done => {
    const rows = [];
    connection.execute({
      sqlText: selectData,
      streamResult: true,
      complete: function (err, stmt) {
        if (err) {
          done(err);
        } else {
          stmt.streamRows()
            .on('error', () => done(err))
            .on('data', row => rows.push(row))
            .on('end', () => {
              try {
                testUtil.checkError(err);
                assert.strictEqual(rows.length, sourceRowCount);
                done();
              } catch (e) {
                done(e);
              }
            });
        }
      }
    });
  });
});
