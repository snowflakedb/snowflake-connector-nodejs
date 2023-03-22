/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
var assert = require('assert');
var async = require('async');
var testUtil = require('./testUtil');

const sourceRowCount = 5000;

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
