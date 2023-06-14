/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
var snowflake = require('./../../lib/snowflake');
var connOptions = require('./connectionOptions');
var assert = require('assert');

module.exports.createConnection = function ()
{
  return snowflake.createConnection(connOptions.valid);
};

module.exports.connect = function (connection, callback)
{
  connection.connect(function (err)
  {
    assert.ok(!err, JSON.stringify(err));
    callback();
  });
};

module.exports.connectAsync = function (connection)
{
  return new Promise((resolve, reject) => {
    connection.connect(err => err ? reject(err) : resolve())
  });
};

module.exports.destroyConnection = function (connection, callback)
{
  connection.destroy(function (err)
  {
    assert.ok(!err, JSON.stringify(err));
    callback();
  })
};

module.exports.destroyConnectionAsync = function (connection)
{
  return new Promise((resolve, reject) => {
    connection.destroy(err => err ? reject(err) : resolve());
  });
};

module.exports.executeCmd = function (connection, sql, callback, bindArray)
{
  var executeOptions = {};
  executeOptions.sqlText = sql;
  executeOptions.complete = function (err)
  {
    assert.ok(!err, JSON.stringify(err));
    callback();
  };

  if (bindArray !== undefined && bindArray != null)
  {
    executeOptions.binds = bindArray;
  }

  connection.execute(executeOptions);
};

module.exports.executeCmdAsync = function (connection, sqlText, binds = undefined)
{
  return new Promise((resolve, reject) =>
  {
    connection.execute({
      sqlText,
      binds,
      complete: (err, _, rows) => err ? reject(err) : resolve(rows)
    });
  });
};

module.exports.checkError = function (err)
{
  assert.ok(!err, JSON.stringify(err));
};

module.exports.executeQueryAndVerify = function (connection, sql, expected, callback, bindArray, normalize, strict)
{
  // Sometimes we may not want to normalize the row first
  normalize = (typeof normalize !== "undefined" && normalize != null) ? normalize : true;
  strict = (typeof strict !== "undefined" && strict != null) ? strict : true;
  var executeOptions = {};
  executeOptions.sqlText = sql;
  executeOptions.complete = function (err, stmt)
  {
    assert.ok(!err, JSON.stringify(err));
    var rowCount = 0;
    var stream = stmt.streamRows();
    stream.on('readable', function ()
    {
      var row;
      while ((row = stream.read()) !== null)
      {
        if (strict)
        {
          assert.deepStrictEqual(normalize ? normalizeRowObject(row) : row, expected[rowCount]);
        }
        else
        {
          assert.deepEqual(normalize ? normalizeRowObject(row) : row, expected[rowCount]);
        }
        rowCount++;
      }
    });
    stream.on('error', function (err)
    {
      assert.ok(!err, JSON.stringify(err));
    });
    stream.on('end', function ()
    {
      assert.strictEqual(rowCount, expected.length);
      callback();
    });
  };
  if (bindArray != null && bindArray != undefined)
  {
    executeOptions.binds = bindArray;
  }

  connection.execute(executeOptions);
};

function normalizeRowObject(row)
{
  var normalizedRow = {};
  for (var key in row)
  {
    if (row.hasOwnProperty(key))
    {
      var convertToString = (row[key] !== null) && (row[key] !== undefined)
        && (typeof row[key].toJSON === 'function');
      var convertToJSNumber = (row[key] !== null) && (row[key] !== undefined)
        && (typeof row[key].toJSNumber === 'function');
      // If this is a bigInt type then convert to JS Number instead of string JSON representation
      if (convertToJSNumber)
      {
        normalizedRow[key] = row[key].toJSNumber();
      }
      else if (convertToString)
      {
        normalizedRow[key] = row[key].toJSON();
      }
      else
      {
        normalizedRow[key] = row[key];
      }
    }
  }
  return normalizedRow;
}



