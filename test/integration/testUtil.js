/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
var snowflake  = require('./../../lib/snowflake');
var connOptions = require('./connectionOptions');
var assert = require('assert');

module.exports.createConnection = function(){
  return snowflake.createConnection(connOptions.valid);
};

module.exports.connect = function(connection, callback){
  connection.connect(function(err){
    assert.ok(!err, JSON.stringify(err));
    callback();
  });
};

module.exports.destroyConnection = function(connection, callback){
  connection.destroy(function(err){
    assert.ok(!err, JSON.stringify(err));
    callback();
  })
};

module.exports.executeCmd = function(connection, sql, callback, bindArray)
{
  var executeOptions = {};
  executeOptions.sqlText = sql;
  executeOptions.complete = function(err)
  {
    assert.ok(!err, JSON.stringify(err));
    callback();
  };

  if (bindArray != null && bindArray != undefined)
  {
    executeOptions.binds = bindArray;
  }

  connection.execute(executeOptions);
};

module.exports.checkError = function(err){
  assert.ok(!err, JSON.stringify(err));
};

module.exports.executeQueryAndVerify = function(connection, sql, expected, callback, bindArray){
  var executeOptions = {};
  executeOptions.sqlText = sql;
  executeOptions.complete = function(err, stmt)
  {
    assert.ok(!err, JSON.stringify(err));
    var rowCount = 0;
    var stream = stmt.streamRows();
    stream.on('readable', function(){
      var row; 
      while((row = stream.read()) !== null)
      {
        assert.deepStrictEqual(normalizeRowObject(row), expected[rowCount]);
        rowCount++;
      }
    });
    stream.on('error', function(err)
    {
      assert.ok(!err, JSON.stringify(err));
    }); 
    stream.on('end', function(){
      assert.strictEqual(rowCount, expected.length);
      callback();
    });
  };
  if(bindArray != null && bindArray != undefined)
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
    if(row.hasOwnProperty(key))
    {
      var convertToString = (row[key] !== null) && (row[key] !== undefined)
        && (typeof row[key].toJSON === 'function');
      normalizedRow[key] = convertToString ?
        row[key].toJSON() : row[key];
    }
  }
  return normalizedRow;
}



