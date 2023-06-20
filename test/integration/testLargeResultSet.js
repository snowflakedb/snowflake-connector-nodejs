/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
const assert = require('assert');
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
});
