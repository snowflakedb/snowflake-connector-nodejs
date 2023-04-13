/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

var assert = require('assert');
var ResultTestCommon = require('./result_test_common');

describe('Result: test variant', function ()
{
  it("select to_variant((parse_json('{ a : 1 }'))) as C1, " +
    "to_object(parse_json('{ a : 1 }')) as C2, " +
    "to_array(parse_json('[1, 2]')) as C3;",
    function (done)
    {
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
              "name": "C1", "byteLength": 16777216, "nullable": true, "precision": null, "scale": null,
              "length": 16777216, "type": "variant"
            }, {
              "name": "C2", "byteLength": 16777216, "nullable": true, "precision": null, "scale": null,
              "length": 16777216, "type": "object"
            }, {
              "name": "C3", "byteLength": 16777216, "nullable": true, "precision": null, "scale": null,
              "length": 16777216, "type": "array"
            }],
            "rowset": [["{\n  \"a\": 1\n}", "{\n  \"a\": 1\n}", "[\n  1,\n  2\n]"]],
            "total": 1,
            "returned": 1,
            "queryId": "34d7c2d2-33ff-416d-a3bc-0b897daec56b",
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
        function (row)
        {
          // variant
          assert.deepEqual(row.getColumnValue('C1'), {a: 1});
          assert.equal(
            row.getColumnValueAsString('C1'), JSON.stringify({a: 1}));

          // object
          assert.deepEqual(row.getColumnValue('C2'), {a: 1});
          assert.equal(
            row.getColumnValueAsString('C2'), JSON.stringify({a: 1}));

          // array
          assert.deepEqual(row.getColumnValue('C3'), [1, 2]);
          assert.equal(
            row.getColumnValueAsString('C3'), JSON.stringify([1, 2]));
        },
        function (result)
        {
          done();
        }
      );
    });
});