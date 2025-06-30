const assert = require('assert');
const ResultTestCommon = require('./result_test_common');

describe('Result: test time', function () {
  it('select to_time(\'12:34:56.789789789\') as C1;',
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
              'name': 'CLIENT_RESULT_PREFETCH_SLOTS', 'value': 2
            }, {
              'name': 'CLIENT_RESULT_PREFETCH_THREADS', 'value': 1
            }, { 'name': 'CLIENT_HONOR_CLIENT_TZ_FOR_TIMESTAMP_NTZ', 'value': true }, {
              'name': 'CLIENT_USE_V1_QUERY_API', 'value': true
            }, { 'name': 'JDBC_EXECUTE_RETURN_COUNT_FOR_DML', 'value': false }, {
              'name': 'JDBC_SHARING_WITH_CANONICAL', 'value': false
            }, { 'name': 'JDBC_REWRITE_WITH_CANONICAL', 'value': false }],
            'rowtype': [{
              'name': 'C1', 'length': null, 'type': 'time', 'byteLength': null, 'nullable': false, 'precision': 0,
              'scale': 9
            }],
            'rowset': [['45296.789789789']],
            'total': 1,
            'returned': 1,
            'queryId': '657e0fcb-b137-410c-845c-a6a9a9680c14',
            'databaseProvider': null,
            'finalDatabaseName': null,
            'finalSchemaName': null,
            'finalWarehouseName': 'IGLOO1',
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
          assert.strictEqual(row.getColumnValue('C1'), '12:34:56');
        },
        function () {
          done();
        }
      );
    });

  it('alter session set TIME_OUTPUT_FORMAT=\'HH24:MI:SS.FF\';' +
    ' select to_time(\'12:34:56.789789789\') as C1;',
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
            }, { 'name': 'TIME_OUTPUT_FORMAT', 'value': 'HH24:MI:SS.FF' }, {
              'name': 'CLIENT_RESULT_PREFETCH_SLOTS', 'value': 2
            }, {
              'name': 'CLIENT_RESULT_PREFETCH_THREADS', 'value': 1
            }, { 'name': 'CLIENT_HONOR_CLIENT_TZ_FOR_TIMESTAMP_NTZ', 'value': true }, {
              'name': 'CLIENT_USE_V1_QUERY_API', 'value': true
            }, { 'name': 'JDBC_EXECUTE_RETURN_COUNT_FOR_DML', 'value': false }, {
              'name': 'JDBC_SHARING_WITH_CANONICAL', 'value': false
            }, { 'name': 'JDBC_REWRITE_WITH_CANONICAL', 'value': false }],
            'rowtype': [{
              'name': 'C1', 'length': null, 'type': 'time', 'byteLength': null, 'nullable': false, 'precision': 0,
              'scale': 9
            }],
            'rowset': [['45296.789789789']],
            'total': 1,
            'returned': 1,
            'queryId': '3ca2ef04-031e-45c9-826e-252e13a96691',
            'databaseProvider': null,
            'finalDatabaseName': null,
            'finalSchemaName': null,
            'finalWarehouseName': 'IGLOO1',
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
        assert.strictEqual(row.getColumnValue('C1'), '12:34:56.789789789');
      },
      function () {
        done();
      }
    );
  });
});
