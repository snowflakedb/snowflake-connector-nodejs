/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

var Util = require('../../../lib/util');
var MockTestUtil = require('./mock_test_util');
var assert = require('assert');
var async = require('async');

// get a mock snowflake instance and an options object to connect to it
var snowflake = MockTestUtil.snowflake;
var connOpts = MockTestUtil.connectionOptions.default;

var stmtOpts =
  {
    sqlText: 'select to_boolean(:1) as "boolean", to_date(:2) as "date", 1.123456789123456789 as "number"',
    binds: ['false', '1967-06-23'],
    requestId: 'foobar'
  };

var numberAsString = '1.123456789123456789';
var booleanAsString = 'FALSE';
var dateAsString = '1967-06-23';

var typesBoolean = [snowflake.BOOLEAN];
var typesNumber = [snowflake.NUMBER];
var typesDate = [snowflake.DATE];

var connOptsNone = Util.apply({}, connOpts);
var connOptsBoolean = Util.apply({fetchAsString: typesBoolean}, connOpts);
var connOptsNumber = Util.apply({fetchAsString: typesNumber}, connOpts);
var connOptsDate = Util.apply({fetchAsString: typesDate}, connOpts);

var stmtOptsNone = Util.apply({}, stmtOpts);
var stmtOptsBoolean = Util.apply({fetchAsString: typesBoolean}, stmtOpts);
var stmtOptsNumber = Util.apply({fetchAsString: typesNumber}, stmtOpts);

var strmOptsNone = {};
var strmOptsNumber = {fetchAsString: typesNumber};
var strmOptsBoolean = {fetchAsString: typesBoolean};
var strmOptsDate = {fetchAsString: typesDate};

describe('Statement - fetch as string', function () {
  var testCases =
    [
      {
        name: 'connection = none, statement = none, stream = number',
        connOpts: connOptsNone,
        stmtOpts: stmtOptsNone,
        strmOpts: strmOptsNumber,
        verifyFn: verifyOnlyNumberConverted
      },
      {
        name: 'connection = none, statement = none, stream = boolean',
        connOpts: connOptsNone,
        stmtOpts: stmtOptsNone,
        strmOpts: strmOptsBoolean,
        verifyFn: verifyOnlyBooleanConverted
      },
      {
        name: 'connection = none, statement = none, stream = date',
        connOpts: connOptsNone,
        stmtOpts: stmtOptsNone,
        strmOpts: strmOptsDate,
        verifyFn: verifyOnlyDateConverted
      },
      {
        name: 'connection = none, statement = boolean, stream = number',
        connOpts: connOptsNone,
        stmtOpts: stmtOptsBoolean,
        strmOpts: strmOptsNumber,
        verifyFn: verifyOnlyNumberConverted
      },
      {
        name: 'connection = date, statement = boolean, stream = number',
        connOpts: connOptsDate,
        stmtOpts: stmtOptsBoolean,
        strmOpts: strmOptsNumber,
        verifyFn: verifyOnlyNumberConverted
      },
      {
        name: 'connection = none, statement = number, stream = none',
        connOpts: connOptsNone,
        stmtOpts: stmtOptsNumber,
        strmOpts: strmOptsNone,
        verifyFn: verifyOnlyNumberConverted
      },
      {
        name: 'connection = boolean, statement = number, stream = none',
        connOpts: connOptsBoolean,
        stmtOpts: stmtOptsNumber,
        strmOpts: strmOptsNone,
        verifyFn: verifyOnlyNumberConverted
      },
      {
        name: 'connection = number, statement = none, stream = none',
        connOpts: connOptsNumber,
        stmtOpts: stmtOptsNone,
        strmOpts: strmOptsNone,
        verifyFn: verifyOnlyNumberConverted
      }
    ];

  for (var index = 0, length = testCases.length; index < length; index++) {
    var testCase = testCases[index];
    it(testCase.name,
      createItCallback(
        testCase.connOpts,
        testCase.stmtOpts,
        testCase.strmOpts,
        testCase.verifyFn));
  }
});

function createItCallback(
  connectionOptions,
  statementOptions,
  streamOptions,
  verifyFn) {
  return function (done) {
    var connection;
    async.series(
      [
        function (callback) {
          connection = snowflake.createConnection(connectionOptions);
          connection.connect(function (err) {
            assert.ok(!err);
            callback();
          });
        },
        function (callback) {
          var rows = [];
          connection.execute(statementOptions).streamRows(streamOptions)
            .on('data', function (row) {
              rows.push(row);
            })
            .on('end', function () {
              verifyFn(rows);
              callback();
            })
            .on('error', function (err) {
              assert.ok(!err);
            });
        }
      ],
      function () {
        done();
      });
  };
}

function verifyOnlyNumberConverted(rows) {
  verifyRows(rows);

  var row = rows[0];

  verifyNumberConverted(row);
  verifyBooleanNotConverted(row);
  verifyDateNotConverted(row);
}

function verifyOnlyBooleanConverted(rows) {
  verifyRows(rows);

  var row = rows[0];

  verifyNumberNotConverted(row);
  verifyBooleanConverted(row);
  verifyDateNotConverted(row);
}

function verifyOnlyDateConverted(rows) {
  verifyRows(rows);

  var row = rows[0];

  verifyNumberNotConverted(row);
  verifyBooleanNotConverted(row);
  verifyDateConverted(row);
}

function verifyRows(rows) {
  assert.ok(Util.isArray(rows));
  assert.strictEqual(rows.length, 1);
}

function verifyNumberNotConverted(row) {
  assert.strictEqual(row.number, 1.1234567891234568);
}

function verifyBooleanNotConverted(row) {
  assert.strictEqual(row.boolean, false);
}

function verifyDateNotConverted(row) {
  assert.ok(Util.isDate(row.date));
  assert.strictEqual(row.date.toJSON(), dateAsString);
}

function verifyNumberConverted(row) {
  assert.strictEqual(row.number, numberAsString);
}

function verifyBooleanConverted(row) {
  assert.strictEqual(row.boolean, booleanAsString);
}

function verifyDateConverted(row) {
  assert.strictEqual(row.date, dateAsString);
}