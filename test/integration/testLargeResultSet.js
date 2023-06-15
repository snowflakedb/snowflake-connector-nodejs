/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
var assert = require('assert');
var async = require('async');
var testUtil = require('./testUtil');

const sourceRowCount = 10000;

describe('Large result Set Tests', function ()
{
  var connection = testUtil.createConnection();
  var selectAllFromOrders = 'select randstr(1000,random()) from table(generator(rowcount=>' + sourceRowCount + '))';

  before(function (done)
  {
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

  after(function (done)
  {
    testUtil.destroyConnection(connection, done);
  });

  it('testSimpeLarge', function (done)
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
});

describe('Large Result Set Tests For Variant Column Type', function ()
{
  var connection = testUtil.createConnection();

  const createTableWithVariant = 'create or replace table testVariantTable(colA variant)';
  const dropTableWithVariant = 'drop table if exists testVariantTable';

  before(function (done)
  {
    async.series(
      [
        function (callback)
        {
          testUtil.connect(connection, callback);
        },
        function (callback)
        {
          testUtil.executeCmd(connection, createTableWithVariant, callback);
        }
      ],
      done
    );
  });

  after(function (done)
  {
    async.series(
      [
        function (callback)
        {
          testUtil.executeCmd(connection, dropTableWithVariant, callback);
        },
        function (callback)
        {
          testUtil.destroyConnection(connection, callback);
        }
      ],
      done
    );
  });

  it('testSelectOnVariantColumnForLargeResultSets', function (done)
  {
    const insertVariant = 'insert into testVariantTable select value from table(flatten(parse_json(?)))';
    const selectVariant = 'select * from testVariantTable';

    const arrJSON = [];
    const sampleJSON = {
      "root":
      {
        "key":
          [
            {
              "key1": "value1",
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

    for (var i = 0; i < sourceRowCount; i++)
    {
      arrJSON.push(sampleJSON);
    }

    async.series([
      function (callback)
      {
        connection.execute({
          sqlText: insertVariant,
          binds: [JSON.stringify(arrJSON)],
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
