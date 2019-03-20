/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
var async = require('async');
var assert = require('assert');
var testUtil = require('./testUtil');

const sourceRowCount = 30000;

describe('Test Concurrent Execution', function()
{
  var connection;
  var selectOrders = 'select true from table(generator(rowcount=>' + sourceRowCount + '))';
  var disableCacheResult = 'alter session set use_cached_result = false';

  before(function(done)
  {
    connection = testUtil.createConnection();
    testUtil.connect(connection, function()
    {
      connection.execute({
        sqlText: disableCacheResult,
        complete: function(err)
        {
          testUtil.checkError(err);
          done();
        }
      });
    });
  });
  
  after(function(done)
  {
    testUtil.destroyConnection(connection, done);
  });

  it('testConcurrentSelectBySameUser', function(done){
    var completedQueries = 0;
    var numberOfQueries = 10;
    for (var i=0; i<numberOfQueries; i++)
    {
      connection.execute({
        sqlText: selectOrders,
        complete: function(err, stmt)
        {
          testUtil.checkError(err);
          var stream = stmt.streamRows();
          var rowCount = 0;
          stream.on('readable', function()
          {
            while( stream.read() !== null)
            {
              rowCount++;
            }
          });
          stream.on('error', function(err){
            testUtil.checkError(err);
          });
          stream.on('end', function()
          {
            assert.strictEqual(rowCount, sourceRowCount);
            completedQueries++;
            if (completedQueries == numberOfQueries)
            {
              done();
            }
          });
        }
      });
    }
  });
  
  it('testConcurrentCreateTable', function(done)
  {
    async.series(
      [
        function(callback)
        {
          var numberOfThread = 10;
          var completedThread = 0;
          for (var i=0; i<numberOfThread; i++)
          {
            testUtil.executeCmd(
              connection,
              'create or replace table test' + i + '(colA varchar)',
              function()
              {
                completedThread ++;
                if (completedThread === numberOfThread)
                {
                  callback();
                }
              }
            );
          }
        },
        function(callback)
        {
          var numberOfThread = 10;
          var completedThread = 0;
          for (var i=0; i<numberOfThread; i++)
          {
            testUtil.executeCmd(
              connection,
              'drop table if exists test' + i,
              function()
              {
                completedThread++;
                if (completedThread === numberOfThread)
                {
                  callback();
                }
              }
            );
          }
        }
      ],
      done
    );
  });

  it('testConcurrentSelectFromDifferentSession', function(done)
  {
    var numberOfQueries = 10;
    var completedQueries = 0;
    for(var i=0; i<numberOfQueries; i++)
    {
      testUtil.createConnection()
      .connect(function(err, conn){
        conn.execute({
          sqlText: selectOrders,
          complete: function(err, stmt)
          {
            var stream = stmt.streamRows();
            var rowCount = 0;
            stream.on('readable', function()
            {
              while( stream.read() !== null)
              {
                rowCount ++;
              }
            });
            stream.on('error', function(err)
            {
              testUtil.checkError(err);
            })
            stream.on('end', function()
            {
              assert.strictEqual(rowCount, sourceRowCount);
              completedQueries++;
              if (completedQueries === numberOfQueries)
              {
                done();
              }
            });
          }
        });
      });
    }
  });
});
