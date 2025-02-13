const Util = require('./../../../../lib/util');
const assert = require('assert');
const ResultTestCommon = require('./result_test_common');

describe('Result: test date', function () {
  it('select to_date(\'2016-01-21\') as C1;',
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
              'name': 'C1', 'byteLength': null, 'nullable': false, 'precision': null, 'scale': null, 'length': null,
              'type': 'date'
            }],
            'rowset': [['16821']],
            'total': 1,
            'returned': 1,
            'queryId': 'ae42fdf6-9fca-4b25-af3c-7c44273b43f6',
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
          assert.ok(Util.isDate(row.getColumnValue('C1')));
          assert.strictEqual(row.getColumnValueAsString('C1'), '2016-01-21');
        },
        function () {
          done();
        }
      );
    });
});