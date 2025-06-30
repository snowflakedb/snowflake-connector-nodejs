const assert = require('assert');
const ResultTestCommon = require('./result_test_common');

describe('Result: test binary', function () {
  it('select X\'0123456789ABCDEF\' as C1;',
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
            }, { 'name': 'TIME_OUTPUT_FORMAT', 'value': 'HH24:MI:SS' }, {
              'name': 'CLIENT_DISABLE_INCIDENTS', 'value': true
            }, {
              'name': 'CLIENT_HONOR_CLIENT_TZ_FOR_TIMESTAMP_NTZ', 'value': true
            }, { 'name': 'CLIENT_RESULT_PREFETCH_SLOTS', 'value': 2 }, {
              'name': 'CLIENT_RESULT_PREFETCH_THREADS', 'value': 1
            }, { 'name': 'CLIENT_USE_V1_QUERY_API', 'value': true }, {
              'name': 'JDBC_EXECUTE_RETURN_COUNT_FOR_DML', 'value': false
            }, {
              'name': 'JDBC_SHARING_WITH_CANONICAL', 'value': false
            }, {
              'name': 'JS_DRIVER_DISABLE_OCSP_FOR_NON_SF_ENDPOINTS', 'value': false
            }, { 'name': 'ODBC_ENABLE_COMPRESSION', 'value': true }, {
              'name': 'CLIENT_SESSION_KEEP_ALIVE', 'value': false
            }, { 'name': 'JDBC_USE_JSON_PARSER', 'value': false }, {
              'name': 'ODBC_USE_NEW_JSON_PARSER', 'value': true
            }, { 'name': 'BINARY_OUTPUT_FORMAT', 'value': 'HEX' }],
            'rowtype': [{
              'name': 'C1', 'database': '', 'schema': '', 'table': '', 'byteLength': 8, 'length': 8, 'type': 'binary',
              'scale': null, 'nullable': false, 'precision': null
            }],
            'rowset': [['0123456789ABCDEF']],
            'total': 1,
            'returned': 1,
            'queryId': '8a103502-3599-42c0-a8e5-6c3fffa0ef5e',
            'databaseProvider': null,
            'finalDatabaseName': null,
            'finalSchemaName': null,
            'finalWarehouseName': 'REGRESS',
            'finalRoleName': 'ACCOUNTADMIN',
            'numberOfBinds': 0,
            'statementTypeId': 4096,
            'version': 1
          },
          'message': null,
          'code': null,
          'success': true
        };

      ResultTestCommon.testResult(
        ResultTestCommon.createResultOptions(response),
        function (row) {
          const buffer = Buffer.from('0123456789ABCDEF', 'hex');
          assert.ok(row.getColumnValue('C1').equals(buffer));
          assert.strictEqual(row.getColumnValueAsString('C1'), '0123456789ABCDEF');
        },
        function () {
          done();
        }
      );
    });

  it('alter session set BINARY_OUTPUT_FORMAT=\'BASE64\';' +
    'select X\'0123456789ABCDEF\' as C1;',
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
            }, { 'name': 'TIME_OUTPUT_FORMAT', 'value': 'HH24:MI:SS' }, {
              'name': 'CLIENT_DISABLE_INCIDENTS', 'value': true
            }, {
              'name': 'CLIENT_HONOR_CLIENT_TZ_FOR_TIMESTAMP_NTZ', 'value': true
            }, { 'name': 'CLIENT_RESULT_PREFETCH_SLOTS', 'value': 2 }, {
              'name': 'CLIENT_RESULT_PREFETCH_THREADS', 'value': 1
            }, { 'name': 'CLIENT_USE_V1_QUERY_API', 'value': true }, {
              'name': 'JDBC_EXECUTE_RETURN_COUNT_FOR_DML', 'value': false
            }, {
              'name': 'JDBC_SHARING_WITH_CANONICAL', 'value': false
            }, {
              'name': 'JS_DRIVER_DISABLE_OCSP_FOR_NON_SF_ENDPOINTS', 'value': false
            }, { 'name': 'ODBC_ENABLE_COMPRESSION', 'value': true }, {
              'name': 'CLIENT_SESSION_KEEP_ALIVE', 'value': false
            }, { 'name': 'JDBC_USE_JSON_PARSER', 'value': false }, {
              'name': 'ODBC_USE_NEW_JSON_PARSER', 'value': true
            }, { 'name': 'BINARY_OUTPUT_FORMAT', 'value': 'BASE64' }],
            'rowtype': [{
              'name': 'C1', 'database': '', 'schema': '', 'table': '', 'byteLength': 8, 'length': 8, 'type': 'binary',
              'scale': null, 'nullable': false, 'precision': null
            }],
            'rowset': [['0123456789ABCDEF']],
            'total': 1,
            'returned': 1,
            'queryId': 'bf9b13b6-f798-4b8a-b255-7565f78bb828',
            'databaseProvider': null,
            'finalDatabaseName': null,
            'finalSchemaName': null,
            'finalWarehouseName': 'REGRESS',
            'finalRoleName': 'ACCOUNTADMIN',
            'numberOfBinds': 0,
            'statementTypeId': 4096,
            'version': 1
          },
          'message': null,
          'code': null,
          'success': true
        };

    ResultTestCommon.testResult(
      ResultTestCommon.createResultOptions(response),
      function (row) {
        const buffer = Buffer.from('0123456789ABCDEF', 'hex');
        assert.ok(row.getColumnValue('C1').equals(buffer));
        assert.strictEqual(row.getColumnValueAsString('C1'), 'ASNFZ4mrze8=');
      },
      function () {
        done();
      }
    );
  });
});
