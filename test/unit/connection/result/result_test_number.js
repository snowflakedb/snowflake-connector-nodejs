const assert = require('assert');
const ResultTestCommon = require('./result_test_common');

describe('Result: test number', function () {
  it('select to_number(\'123.456\') as C1, ' +
    'to_double(\'123.456\') as C2, ' +
    'to_number(\'12345678901234567890123456789012345678\') as C3, ' + // pragma: allowlist secret
    'to_double(\'12345678901234567890123456789012345678\') as C4;', // pragma: allowlist secret
  function (done) {
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
              'name': 'C1', 'byteLength': null, 'nullable': false, 'precision': 38, 'scale': 0, 'length': null,
              'type': 'fixed'
            }, {
              'name': 'C2', 'byteLength': null, 'nullable': false, 'precision': null, 'scale': null, 'length': null,
              'type': 'real'
            }, {
              'name': 'C3', 'byteLength': null, 'nullable': false, 'precision': 38, 'scale': 0, 'length': null,
              'type': 'fixed'
            }, {
              'name': 'C4', 'byteLength': null, 'nullable': false, 'precision': null, 'scale': null, 'length': null,
              'type': 'real'
            }],
            'rowset': [['123', '123.456', '12345678901234567890123456789012345678', '1.23456789012346e+37']], // pragma: allowlist secret
            'total': 1,
            'returned': 1,
            'queryId': 'd1d201b7-66e5-4692-b062-eaec596771fe',
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
        // fixed small
        assert.strictEqual(row.getColumnValue('C1'), 123);
        assert.strictEqual(row.getColumnValueAsString('C1'), '123');

        // real small
        assert.strictEqual(row.getColumnValue('C2'), 123.456);
        assert.strictEqual(row.getColumnValueAsString('C2'), '123.456');

        // fixed big
        assert.strictEqual(row.getColumnValue('C3'), 1.2345678901234568e+37);
        assert.strictEqual(
          row.getColumnValueAsString('C3'),
          '12345678901234567890123456789012345678'); // pragma: allowlist secret

        // real big
        assert.strictEqual(row.getColumnValue('C4'), 1.23456789012346e+37);
        assert.strictEqual(
          row.getColumnValueAsString('C4'), '1.23456789012346e+37');
      },
      function () {
        done();
      }
    );
  });
});