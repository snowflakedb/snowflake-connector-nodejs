const Util = require('./../../../../lib/util');
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
        }, { 'name': 'TIMESTAMP_TZ_OUTPUT_FORMAT', 'value': '' }, { 'name': 'CLIENT_RESULT_PREFETCH_SLOTS', 'value': 2 }],
        'rowtype': [{
          'name': 'C1', 'byteLength': null, 'length': null, 'type': 'fixed', 'nullable': false, 'precision': 19,
          'scale': 0
        }, {
          'name': 'C2', 'byteLength': 16777216, 'length': 16777216, 'type': 'text', 'nullable': false,
          'precision': null, 'scale': null
        }],
        'rowset': [['0', '046Bo'],
          ['1', 'CaFHJ'],
          ['2', 'egeN4'],
          ['3', 'QmNTp'],
          ['4', 'tsmZJ'],
          ['5', '5yV54'],
          ['6', 'HFubp'],
          ['7', 'kL3hK'],
          ['8', 'WRCn4'],
          ['9', 'yXbtp']],
        'total': 10,
        'returned': 10,
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

  it('small result', function (done) {
    const rows = [];

    ResultTestCommon.testResult(
      ResultTestCommon.createResultOptions(response),
      function (row) {
        rows.push(row);
      },
      function (result) {
        const responseData = response.data;

        assert.strictEqual(result.getTotalRows(), responseData.total);
        assert.strictEqual(result.getReturnedRows(), responseData.returned);
        assert.strictEqual(result.getStatementId(), responseData.queryId);
        assert.strictEqual(result.getQueryId(), responseData.queryId);
        assert.strictEqual(result.getVersion(), String(responseData.version));

        const sessionState = result.getSessionState();

        assert.strictEqual(
          sessionState.getCurrentDatabaseProvider(),
          responseData.databaseProvider);

        assert.strictEqual(
          sessionState.getCurrentDatabase(),
          responseData.finalDatabaseName);

        assert.strictEqual(
          sessionState.getCurrentSchema(),
          responseData.finalSchemaName);

        assert.strictEqual(
          sessionState.getCurrentWarehouse(),
          responseData.finalWarehouseName);

        assert.strictEqual(
          sessionState.getCurrentRole(),
          responseData.finalRoleName);

        const rowtype = responseData.rowtype;
        const rowset = responseData.rowset;

        const columns = result.getColumns();

        assert.strictEqual(columns.length, rowtype.length);

        let rowIndex, rowsLength, row;
        for (rowIndex = 0, rowsLength = rows.length; rowIndex < rowsLength;
          rowIndex++) {
          row = rows[rowIndex];

          assert.ok(Util.isObject(row));
          assert.strictEqual(row.rowIndex, rowIndex);

          let columnIndex, columnsLength, column;
          for (columnIndex = 0, columnsLength = columns.length;
            columnIndex < columnsLength; columnIndex++) {
            column = columns[columnIndex];

            assert.strictEqual(
              rowset[rowIndex][columnIndex],
              String(row.getColumnValue(column.getName())));

            // TODO: for columns of type number, test getColumnValueAsString()
            // as well
          }
        }

        done();
      },
      0,
      5);
  });
});