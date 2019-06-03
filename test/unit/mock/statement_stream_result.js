/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

var Util         = require('../../../lib/util');
var MockTestUtil = require('./mock_test_util');
var assert       = require('assert');
var async        = require('async');

// get a mock snowflake instance and an options object to connect to it
var snowflake = MockTestUtil.snowflake;
var connOpts = MockTestUtil.connectionOptions.default;

var connOptsStreamResultNone = Util.apply({}, connOpts);
var connOptsStreamResultFalse = Util.apply({ streamResult: false }, connOpts);
var connOptsStreamResultTrue = Util.apply({ streamResult: true }, connOpts);

describe('Statement - stream result', function()
{
  var testCases =
  [
    {
      name         : 'connection = none, statement = none',
      connOpts     : connOptsStreamResultNone,
      streamResult : undefined,
      verifyFn     : verifyRowsReturnedInline
    },
    {
      name         : 'connection = none, statement = false',
      connOpts     : connOptsStreamResultNone,
      streamResult : false,
      verifyFn     : verifyRowsReturnedInline
    },
    {
      name         : 'connection = none, statement = true',
      connOpts     : connOptsStreamResultNone,
      streamResult : true,
      verifyFn     : verifyNoRowsReturnedInline
    },
    {
      name         : 'connection = false, statement = none',
      connOpts     : connOptsStreamResultFalse,
      streamResult : undefined,
      verifyFn     : verifyRowsReturnedInline
    },
    {
      name         : 'connection = false, statement = false',
      connOpts     : connOptsStreamResultFalse,
      streamResult : false,
      verifyFn     : verifyRowsReturnedInline
    },
    {
      name         : 'connection = false, statement = true',
      connOpts     : connOptsStreamResultFalse,
      streamResult : true,
      verifyFn     : verifyNoRowsReturnedInline
    },
    {
      name         : 'connection = true, statement = none',
      connOpts     : connOptsStreamResultTrue,
      streamResult : undefined,
      verifyFn     : verifyNoRowsReturnedInline
    },
    {
      name         : 'connection = true, statement = false',
      connOpts     : connOptsStreamResultTrue,
      streamResult : false,
      verifyFn     : verifyRowsReturnedInline
    },
    {
      name         : 'connection = true, statement = true',
      connOpts     : connOptsStreamResultTrue,
      streamResult : true,
      verifyFn     : verifyNoRowsReturnedInline
    }
  ];

  for (var index = 0, length = testCases.length; index < length; index++)
  {
    var testCase = testCases[index];
    it(testCase.name, createItCallback(
        testCase.connOpts, testCase.streamResult, testCase.verifyFn));
  }
});

function createItCallback(connectionOptions, streamResult, verifyFn)
{
  return function(done)
  {
    var connection;
    async.series(
    [
      function(callback)
      {
        connection = snowflake.createConnection(connectionOptions);
        connection.connect(function(err)
        {
          callback();
        });
      },
      function(callback)
      {
        connection.execute(
        {
          sqlText      : 'select 1 as "c1";',
          requestId    : 'foobar',
          streamResult : streamResult,
          complete     : function(err, statement, rows)
          {
            verifyFn(rows);
            callback();
          }
        });
      }
    ],
    function()
    {
      done();
    });
  };
}

function verifyRowsReturnedInline(rows)
{
  assert.ok(Util.isArray(rows));
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].c1.toJSNumber(), 1);
}

function verifyNoRowsReturnedInline(rows)
{
  assert.ok(!Util.exists(rows));
}