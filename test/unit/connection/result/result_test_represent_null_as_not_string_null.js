const Util = require('../../../../lib/util');
const assert = require('assert');
const ResultTestCommon = require('./result_test_common');

describe('Result', function () {
  const response =
    {
      'data': {
        'parameters': [{ 'name': 'DATE_OUTPUT_FORMAT', 'value': 'YYYY-MM-DD' }, {
          'name': 'CLIENT_USE_V1_QUERY_API', 'value': true
        }, { 'name': 'TIMESTAMP_LTZ_OUTPUT_FORMAT', 'value': '' }, {
          'name': 'TIMESTAMP_NTZ_OUTPUT_FORMAT', 'value': ''
        }, { 'name': 'CLIENT_RESULT_PREFETCH_THREADS', 'value': 1 }, {
          'name': 'CLIENT_HONOR_CLIENT_TZ_FOR_TIMESTAMP_NTZ', 'value': true
        }, { 'name': 'TIMEZONE', 'value': 'America/Los_Angeles' }, {
          'name': 'TIMESTAMP_OUTPUT_FORMAT', 'value': 'DY, DD MON YYYY HH24:MI:SS TZHTZM'
        }, { 'name': 'TIMESTAMP_TZ_OUTPUT_FORMAT', 'value': '' }, { 'name': 'CLIENT_RESULT_PREFETCH_SLOTS', 'value': 2 },
        { 'name': 'BINARY_OUTPUT_FORMAT', 'value': 'BASE64' }],
        'rowtype': [{
          'name': 'C1', 'byteLength': null, 'length': null, 'type': 'fixed', 'nullable': false, 'precision': 19,
          'scale': 0
        }, {
          'name': 'C2', 'byteLength': 16777216, 'length': 16777216, 'type': 'text', 'nullable': false,
          'precision': null, 'scale': null
        }, {
          'name': 'C3', 'byteLength': null, 'nullable': false, 'precision': null, 'scale': null, 'length': null,
          'type': 'date'
        }, {
          'name': 'C4', 'database': '', 'schema': '', 'table': '', 'byteLength': 8, 'length': 8, 'type': 'binary',
          'scale': null, 'nullable': false, 'precision': null
        }, {
          'name': 'C5', 'byteLength': null, 'nullable': true, 'precision': null, 'scale': null, 'length': null,
          'type': 'boolean'
        }
        ],
        'rowset': [['0', 'a', '16821', '0123456789ABCDEF', 'TRUE'],
          [null, null, null, null, null],
        ],
        'total': 2,
        'returned': 2,
        'queryId': '71823c4d-1709-47b4-ad76-1d4a5df769f8',
        'databaseProvider': null,
        'finalDatabaseName': null,
        'finalSchemaName': null,
        'finalWarehouseName': 'NEW_WH',
        'finalRoleName': 'ACCOUNTADMIN',
        'numberOfBinds': 0,
        'statementTypeId': 4096,
        'version': 0
      },
      'message': null,
      'code': null,
      'success': true
    };

  it('verify whether null values are returned as nulls ', function (done) {
    const rows = [];
    ResultTestCommon.testResult(
      ResultTestCommon.createResultOptions(response, { representNullAsStringNull: false }),
      function (row) {
        rows.push(row);
      },
      function () {
        testNotNullData(rows[0]);
        testNullData(rows[1]);
        done();
      },
    );
  });
});

function testNotNullData(row) {
  assert.strictEqual(row.getColumnValue('C1'), 0);
  assert.strictEqual(row.getColumnValueAsString('C1'), '0');

  assert.strictEqual(row.getColumnValue('C2'), 'a');
  assert.strictEqual(row.getColumnValueAsString('C2'), 'a');

  assert.ok(Util.isDate(row.getColumnValue('C3')));
  assert.strictEqual(row.getColumnValueAsString('C3'), '2016-01-21');

  const buffer = Buffer.from('0123456789ABCDEF', 'hex');
  assert.ok(row.getColumnValue('C4').equals(buffer));
  assert.strictEqual(row.getColumnValueAsString('C4'), 'ASNFZ4mrze8=');

  assert.strictEqual(row.getColumnValue('C5'), true);
  assert.strictEqual(row.getColumnValueAsString('C5'), 'TRUE');
}

function testNullData(row) {
  assert.strictEqual(row.getColumnValue('C1'), null);
  assert.strictEqual(row.getColumnValueAsString('C1'), null);

  assert.strictEqual(row.getColumnValue('C2'), null);
  assert.strictEqual(row.getColumnValueAsString('C2'), null);

  assert.strictEqual(row.getColumnValue('C3'), null);
  assert.strictEqual(row.getColumnValueAsString('C3'), null);

  assert.strictEqual(row.getColumnValue('C4'), null);
  assert.strictEqual(row.getColumnValueAsString('C4'), null);

  assert.strictEqual(row.getColumnValue('C5'), null);
  assert.strictEqual(row.getColumnValueAsString('C5'), null);
}
