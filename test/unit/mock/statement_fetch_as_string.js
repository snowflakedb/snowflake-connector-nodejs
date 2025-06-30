const Util = require('../../../lib/util');
const MockTestUtil = require('./mock_test_util');
const assert = require('assert');
const async = require('async');

// get a mock snowflake instance and an options object to connect to it
const snowflake = MockTestUtil.snowflake;
const connOpts = MockTestUtil.connectionOptions.default;

const stmtOpts =
  {
    sqlText: 'select to_boolean(:1) as "boolean", to_date(:2) as "date", 1.123456789123456789 as "number"',
    binds: ['false', '1967-06-23'],
    requestId: 'foobar'
  };

const numberAsString = '1.123456789123456789';
const booleanAsString = 'FALSE';
const dateAsString = '1967-06-23';

const typesBoolean = [snowflake.BOOLEAN];
const typesNumber = [snowflake.NUMBER];
const typesDate = [snowflake.DATE];

const connOptsNone = Util.apply({}, connOpts);
const connOptsBoolean = Util.apply({ fetchAsString: typesBoolean }, connOpts);
const connOptsNumber = Util.apply({ fetchAsString: typesNumber }, connOpts);
const connOptsDate = Util.apply({ fetchAsString: typesDate }, connOpts);

const stmtOptsNone = Util.apply({}, stmtOpts);
const stmtOptsBoolean = Util.apply({ fetchAsString: typesBoolean }, stmtOpts);
const stmtOptsNumber = Util.apply({ fetchAsString: typesNumber }, stmtOpts);

const strmOptsNone = {};
const strmOptsNumber = { fetchAsString: typesNumber };
const strmOptsBoolean = { fetchAsString: typesBoolean };
const strmOptsDate = { fetchAsString: typesDate };

describe('Statement - fetch as string', function () {
  const testCases =
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

  for (let index = 0, length = testCases.length; index < length; index++) {
    const testCase = testCases[index];
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
    let connection;
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
          const rows = [];
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

  const row = rows[0];

  verifyNumberConverted(row);
  verifyBooleanNotConverted(row);
  verifyDateNotConverted(row);
}

function verifyOnlyBooleanConverted(rows) {
  verifyRows(rows);

  const row = rows[0];

  verifyNumberNotConverted(row);
  verifyBooleanConverted(row);
  verifyDateNotConverted(row);
}

function verifyOnlyDateConverted(rows) {
  verifyRows(rows);

  const row = rows[0];

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