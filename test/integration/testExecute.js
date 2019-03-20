/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
var async = require('async');
var testUtil = require('./testUtil');

describe('Execute test', function()
{
  var connection;
  var createNodeTSQL = 'create or replace table NodeT(colA number, colB varchar)';
  var selectAllSQL = 'select * from NodeT';
  var insertNodeTSQL = 'insert into NodeT values(1, \'a\')';
  var updateNodeTSQL = 'update NodeT set COLA = 2, COLB = \'b\' where COLA = 1';
  var dropNodeTSQL = 'drop table if exists NodeT';

  before(function(done)
  {
    connection = testUtil.createConnection();
    async.series([
      function(callback)
      {
        testUtil.connect(connection, callback);
      }],
      done 
    );
  });

  after(function(done)
  {
    async.series([
      function(callback)
      {
        testUtil.destroyConnection(connection, callback);
      }],
      done 
    );
  });

  it('testSimpleInsert', function(done)
  {
    async.series(
    [
      function(callback)
      {
        testUtil.executeCmd(connection, createNodeTSQL, callback);
      },
      function(callback)
      {
        var insertCount = 5;
        var insertValues = function(i)
        {
          if (i<insertCount)
          {
            testUtil.executeCmd(connection, 
              insertNodeTSQL,
              function(){
                insertValues(i+1); 
              });
          }
          else
          {
            callback(); 
          }
        };
        insertValues(0);
      },
      function(callback)
      {
        testUtil.executeQueryAndVerify(
          connection,
          selectAllSQL,
          [{'COLA': 1, 'COLB': 'a'},
           {'COLA': 1, 'COLB': 'a'},
           {'COLA': 1, 'COLB': 'a'},
           {'COLA': 1, 'COLB': 'a'},
           {'COLA': 1, 'COLB': 'a'}],
          callback
        );
      },
      function(callback)
      {
        testUtil.executeCmd(
          connection,
          dropNodeTSQL, 
          callback
        );
      }],
      done 
    );
  });

  it('testSimpleUpdate', function(done){
    async.series([
      function(callback)
      {
        testUtil.executeCmd(connection, createNodeTSQL, callback);
      },
      function(callback)
      {
        testUtil.executeCmd(connection, insertNodeTSQL, callback);
      },
      function(callback)
      {
        testUtil.executeCmd(connection, updateNodeTSQL, callback);
      },
      function(callback)
      {
        testUtil.executeQueryAndVerify(
          connection,
          selectAllSQL,
          [{'COLA': 2, 'COLB': 'b'}],
          callback
        );
      },
      function(callback)
      {
        testUtil.executeCmd(
          connection,
          dropNodeTSQL,
          callback
        );
      }],
      done 
    );
  });

  it('testDDLResultSet', function(done)
  {
    async.series(
      [
        function(callback)
        {
          testUtil.executeQueryAndVerify(
            connection,
            createNodeTSQL,
            [{'status': 'Table NODET successfully created.'}],
            callback
          );
        },
        function(callback)
        {
          testUtil.executeQueryAndVerify(
            connection,
            insertNodeTSQL,
            [{'number of rows inserted': 1}],
            callback
          );
        },
        function(callback)
        {
          testUtil.executeCmd(connection, dropNodeTSQL, callback);
        }
      ],
      done
    );
  });
});

