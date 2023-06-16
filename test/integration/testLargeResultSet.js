/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
const assert = require('assert');
const async = require('async');
const testUtil = require('./testUtil');

const sourceRowCount = 10000;

describe('Large result Set Tests', function ()
{
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
