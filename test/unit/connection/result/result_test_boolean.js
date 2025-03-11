const assert = require('assert');
const ResultTestCommon = require('./result_test_common');

describe('Result: test boolean', function () {
  it('select true as C1, false as C2, to_boolean(null) as C3;', function (done) {
    const response =
      {
        'data': {
          'parameters': [{ 'name': 'TIMEZONE', 'value': 'America/Los_Angeles' }, {
            'name': 'TIMESTAMP_OUTPUT_FORMAT', 'value': 'DY, DD MON YYYY HH24:MI:SS TZHTZM'
          }, { 'name': 'TIMESTAMP_NTZ_OUTPUT_FORMAT', 'value': '' }, {
            'name': 'TIMESTAMP_LTZ_OUTPUT_FORMAT', 'value': ''
          }, { 'name': 'TIMESTAMP_TZ_OUTPUT_FORMAT', 'value': '' }, {
            'name': 'DATE_OUTPUT_FORMAT', 'value': 'YYYY-MM-DD'
          }, { 'name': 'CLIENT_RESULT_PREFETCH_SLOTS', 'value': 2 }, {
            'name': 'CLIENT_RESULT_PREFETCH_THREADS', 'value': 1
          }, { 'name': 'CLIENT_HONOR_CLIENT_TZ_FOR_TIMESTAMP_NTZ', 'value': true }, {
            'name': 'CLIENT_USE_V1_QUERY_API', 'value': true
          }],
          'rowtype': [{
            'name': 'C1', 'byteLength': null, 'nullable': true, 'precision': null, 'scale': null, 'length': null,
            'type': 'boolean'
          }, {
            'name': 'C2', 'byteLength': null, 'nullable': true, 'precision': null, 'scale': null, 'length': null,
            'type': 'boolean'
          }, {
            'name': 'C3', 'byteLength': null, 'nullable': true, 'precision': null, 'scale': null, 'length': null,
            'type': 'boolean'
          }],
          'rowset': [['TRUE', 'FALSE', null]],
          'total': 1,
          'returned': 1,
          'queryId': '639a9c40-ea39-4a2b-949e-7e44b2864cfc',
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

    ResultTestCommon.testResult(
      ResultTestCommon.createResultOptions(response),
      function (row) {
        // true
        assert.strictEqual(row.getColumnValue('C1'), true);
        assert.strictEqual(row.getColumnValueAsString('C1'), 'TRUE');

        // false
        assert.strictEqual(row.getColumnValue('C2'), false);
        assert.strictEqual(row.getColumnValueAsString('C2'), 'FALSE');

        // null
        assert.strictEqual(row.getColumnValue('C3'), null);
        assert.strictEqual(row.getColumnValueAsString('C3'), 'NULL');
      },
      function () {
        done();
      }
    );
  });

  it('select to_boolean(\'1\') as C1, to_boolean(\'0\') as C2, \' + ' +
    '\'to_boolean(null) as C3;', function (done) {
    const response =
      {
        'data': {
          'parameters': [{ 'name': 'TIMEZONE', 'value': 'America/Los_Angeles' }, {
            'name': 'TIMESTAMP_OUTPUT_FORMAT', 'value': 'DY, DD MON YYYY HH24:MI:SS TZHTZM'
          }, { 'name': 'TIMESTAMP_NTZ_OUTPUT_FORMAT', 'value': '' }, {
            'name': 'TIMESTAMP_LTZ_OUTPUT_FORMAT', 'value': ''
          }, { 'name': 'TIMESTAMP_TZ_OUTPUT_FORMAT', 'value': '' }, {
            'name': 'DATE_OUTPUT_FORMAT', 'value': 'YYYY-MM-DD'
          }, { 'name': 'CLIENT_RESULT_PREFETCH_SLOTS', 'value': 2 }, {
            'name': 'CLIENT_RESULT_PREFETCH_THREADS', 'value': 1
          }, { 'name': 'CLIENT_HONOR_CLIENT_TZ_FOR_TIMESTAMP_NTZ', 'value': true }, {
            'name': 'CLIENT_USE_V1_QUERY_API', 'value': true
          }],
          'rowtype': [{
            'name': 'C1', 'byteLength': null, 'nullable': false, 'precision': null, 'scale': null, 'length': null,
            'type': 'boolean'
          }, {
            'name': 'C2', 'byteLength': null, 'nullable': false, 'precision': null, 'scale': null, 'length': null,
            'type': 'boolean'
          }, {
            'name': 'C3', 'byteLength': null, 'nullable': true, 'precision': null, 'scale': null, 'length': null,
            'type': 'boolean'
          }],
          'rowset': [['1', '0', null]],
          'total': 1,
          'returned': 1,
          'queryId': '72cbfd5a-c604-4271-bb29-8f36e82451de',
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

    ResultTestCommon.testResult(
      ResultTestCommon.createResultOptions(response),
      function (row) {
        // true
        assert.strictEqual(row.getColumnValue('C1'), true);
        assert.strictEqual(row.getColumnValueAsString('C1'), 'TRUE');

        // false
        assert.strictEqual(row.getColumnValue('C2'), false);
        assert.strictEqual(row.getColumnValueAsString('C2'), 'FALSE');

        // null
        assert.strictEqual(row.getColumnValue('C3'), null);
        assert.strictEqual(row.getColumnValueAsString('C3'), 'NULL');
      },
      function () {
        done();
      }
    );
  });
});