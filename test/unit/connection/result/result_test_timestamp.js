const Util = require('./../../../../lib/util');
const assert = require('assert');
const ResultTestCommon = require('./result_test_common');

function checkSingleTimestamp(dateRowset, timestampOutputFormat, scale, expectedJson, done, additionalValidations = undefined) {
  const response =
    {
      'data': {
        'parameters': [
          { 'name': 'TIMEZONE', 'value': 'America/Los_Angeles' },
          { 'name': 'TIMESTAMP_OUTPUT_FORMAT', 'value': timestampOutputFormat },
          { 'name': 'TIMESTAMP_NTZ_OUTPUT_FORMAT', 'value': '' },
          { 'name': 'TIMESTAMP_LTZ_OUTPUT_FORMAT', 'value': '' },
          { 'name': 'TIMESTAMP_TZ_OUTPUT_FORMAT', 'value': '' },
          { 'name': 'DATE_OUTPUT_FORMAT', 'value': 'YYYY-MM-DD' },
          { 'name': 'CLIENT_RESULT_PREFETCH_SLOTS', 'value': 2 },
          { 'name': 'CLIENT_RESULT_PREFETCH_THREADS', 'value': 1 },
          { 'name': 'CLIENT_HONOR_CLIENT_TZ_FOR_TIMESTAMP_NTZ', 'value': true },
          { 'name': 'CLIENT_USE_V1_QUERY_API', 'value': true }
        ],
        'rowtype': [{
          'name': 'C1',
          'byteLength': null,
          'nullable': false,
          'precision': 0,
          'scale': scale,
          'length': null,
          'type': 'timestamp_ntz'
        }],
        'rowset': [[dateRowset]],
        'total': 1,
        'returned': 1,
        'queryId': 'b603b7fb-48df-48b6-bc90-25a7cb355e1d',
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
      const actualTimestamp = row.getColumnValue('C1');
      assert.ok(Util.isDate(row.getColumnValue('C1')));
      assert.strictEqual(actualTimestamp.toJSON(), expectedJson);
      if (additionalValidations !== undefined) {
        additionalValidations(actualTimestamp);
      }
    },
    function () {
      done();
    }
  );
}

describe('Result: test timestamp', function () {

  it('select to_timestamp_ltz(\'Thu, 21 Jan 2016 06:32:44 -0800\') as C1, ' +
    'to_timestamp_tz(\'Thu, 21 Jan 2016 06:32:44 -0800\') as C2, ' +
    'to_timestamp_ntz(\'Thu, 21 Jan 2016 06:32:44 -0800\') as C3;',
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
              'name': 'C1', 'byteLength': null, 'nullable': false, 'precision': 0, 'scale': 9, 'length': null,
              'type': 'timestamp_ltz'
            }, {
              'name': 'C2', 'byteLength': null, 'nullable': false, 'precision': 0, 'scale': 9, 'length': null,
              'type': 'timestamp_tz'
            }, {
              'name': 'C3', 'byteLength': null, 'nullable': false, 'precision': 0, 'scale': 9, 'length': null,
              'type': 'timestamp_ntz'
            }],
            'rowset': [['1453386764.000000000', '23812288741376.000000960', '1453357964.000000000']],
            'total': 1,
            'returned': 1,
            'queryId': 'b603b7fb-48df-48b6-bc90-25a7cb355e1d',
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
        // timestamp_ltz
        assert.ok(Util.isDate(row.getColumnValue('C1')));
        assert.strictEqual(
          row.getColumnValueAsString('C1'),
          'Thu, 21 Jan 2016 06:32:44 -0800');

        // timestamp_tz
        assert.ok(Util.isDate(row.getColumnValue('C2')));
        assert.strictEqual(
          row.getColumnValueAsString('C2'),
          'Thu, 21 Jan 2016 06:32:44 -0800');

        row.getColumnValueAsString('C3');

        // timestamp_ntz
        assert.ok(Util.isDate(row.getColumnValue('C3')));
        assert.strictEqual(
          row.getColumnValueAsString('C3'),
          'Thu, 21 Jan 2016 06:32:44 +0000');
      },
      function () {
        done();
      }
    );
  });

  it('select dateadd(ns,-1, to_timestamp_ntz(\'10000-01-01T00:00:00\', \'YYYY-MM-DD"T"HH24:MI:SS\')) AS C1;',
    function (done) {
      checkSingleTimestamp(
        '253402300799.999999999',
        'YYYY-MM-DD HH24:MI:SS.FF3',
        9,
        '9999-12-31 23:59:59.999',
        done,
        (actualTimestamp) => {
          assert.strictEqual(actualTimestamp.getNanoSeconds(), 999999999);
          assert.strictEqual(actualTimestamp.getEpochSeconds(), 253402300799);
          assert.strictEqual(actualTimestamp.getScale(), 9);
        }
      );
    }
  );

  it('select to_timestamp_ntz(\'2024-04-16T14:57:58:999\', \'YYYY-MM-DD"T"HH24:MI:SS:FF3\') AS C1;',
    function (done) {
      checkSingleTimestamp(
        '1713279478.999',
        'YYYY-MM-DD HH24:MI:SS.FF3',
        3,
        '2024-04-16 14:57:58.999',
        done
      );
    }
  );

  it('select to_timestamp_ntz(\'2024-04-16T14:57:58:001\', \'YYYY-MM-DD"T"HH24:MI:SS:FF3\') AS C1;',
    function (done) {
      checkSingleTimestamp(
        '1713279478.001',
        'YYYY-MM-DD HH24:MI:SS.FF3',
        3,
        '2024-04-16 14:57:58.001',
        done
      );
    }
  );
  
  it('select to_timestamp_ntz(\'2024-04-16T14:57:58:999999999\', \'YYYY-MM-DD"T"HH24:MI:SS:FF9\') AS C1;',
    function (done) {
      checkSingleTimestamp(
        '1713279478.999999999',
        'YYYY-MM-DD HH24:MI:SS.FF9',
        9,
        '2024-04-16 14:57:58.999999999',
        done
      );
    }
  );

  it('select to_timestamp_ntz(\'2024-04-16T14:57:58:000000001\', \'YYYY-MM-DD"T"HH24:MI:SS:FF9\')) AS C1;',
    function (done) {
      checkSingleTimestamp(
        '1713279478.000000001',
        'YYYY-MM-DD HH24:MI:SS.FF9',
        9,
        '2024-04-16 14:57:58.000000001',
        done
      );
    }
  );
});