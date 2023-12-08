/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

var Util = require('./../../../../lib/util');
var assert = require('assert');
var ResultTestCommon = require('./result_test_common');

describe('Result: test timestamp', function () {
  it("select to_timestamp_ltz('Thu, 21 Jan 2016 06:32:44 -0800') as C1, " +
    "to_timestamp_tz('Thu, 21 Jan 2016 06:32:44 -0800') as C2, " +
    "to_timestamp_ntz('Thu, 21 Jan 2016 06:32:44 -0800') as C3;",
  function (done) {
    var response =
        {
          "data": {
            "parameters": [{"name": "TIMEZONE", "value": "America/Los_Angeles"}, {
              "name": "TIMESTAMP_OUTPUT_FORMAT", "value": "DY, DD MON YYYY HH24:MI:SS TZHTZM"
            }, {"name": "TIMESTAMP_NTZ_OUTPUT_FORMAT", "value": ""}, {
              "name": "TIMESTAMP_LTZ_OUTPUT_FORMAT", "value": ""
            }, {"name": "TIMESTAMP_TZ_OUTPUT_FORMAT", "value": ""}, {
              "name": "DATE_OUTPUT_FORMAT", "value": "YYYY-MM-DD"
            }, {"name": "CLIENT_RESULT_PREFETCH_SLOTS", "value": 2}, {
              "name": "CLIENT_RESULT_PREFETCH_THREADS", "value": 1
            }, {"name": "CLIENT_HONOR_CLIENT_TZ_FOR_TIMESTAMP_NTZ", "value": true}, {
              "name": "CLIENT_USE_V1_QUERY_API", "value": true
            }],
            "rowtype": [{
              "name": "C1", "byteLength": null, "nullable": false, "precision": 0, "scale": 9, "length": null,
              "type": "timestamp_ltz"
            }, {
              "name": "C2", "byteLength": null, "nullable": false, "precision": 0, "scale": 9, "length": null,
              "type": "timestamp_tz"
            }, {
              "name": "C3", "byteLength": null, "nullable": false, "precision": 0, "scale": 9, "length": null,
              "type": "timestamp_ntz"
            }],
            "rowset": [["1453386764.000000000", "23812288741376.000000960", "1453357964.000000000"]],
            "total": 1,
            "returned": 1,
            "queryId": "b603b7fb-48df-48b6-bc90-25a7cb355e1d",
            "databaseProvider": null,
            "finalDatabaseName": null,
            "finalSchemaName": null,
            "finalWarehouseName": "NEW_WH",
            "finalRoleName": "ACCOUNTADMIN",
            "numberOfBinds": 0,
            "statementTypeId": 4096,
            "version": 0
          },
          "message": null,
          "code": null,
          "success": true
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
      function (result) {
        done();
      }
    );
  });
});