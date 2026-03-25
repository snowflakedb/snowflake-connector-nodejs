const sinon = require('sinon');
const Logger = require('./../../../../lib/logger').default;
const assert = require('assert');
const ResultTestCommon = require('./result_test_common');
const GlobalConfig = require('./../../../../lib/global_config');

describe('Result: test variant parsing', function () {
  let logWarnSpy;
  let originalParser;

  beforeEach(() => {
    logWarnSpy = sinon.spy(Logger(), 'warn');
    originalParser = GlobalConfig.jsonColumnVariantParser;
  });

  afterEach(() => {
    GlobalConfig.jsonColumnVariantParser = originalParser;
    sinon.restore();
  });

  function createVariantResponse(rowset) {
    return {
      data: {
        parameters: [
          { name: 'TIMEZONE', value: 'America/Los_Angeles' },
          { name: 'TIMESTAMP_OUTPUT_FORMAT', value: 'DY, DD MON YYYY HH24:MI:SS TZHTZM' },
          { name: 'TIMESTAMP_NTZ_OUTPUT_FORMAT', value: '' },
          { name: 'TIMESTAMP_LTZ_OUTPUT_FORMAT', value: '' },
          { name: 'TIMESTAMP_TZ_OUTPUT_FORMAT', value: '' },
          { name: 'DATE_OUTPUT_FORMAT', value: 'YYYY-MM-DD' },
          { name: 'CLIENT_RESULT_PREFETCH_SLOTS', value: 2 },
          { name: 'CLIENT_RESULT_PREFETCH_THREADS', value: 1 },
          { name: 'CLIENT_HONOR_CLIENT_TZ_FOR_TIMESTAMP_NTZ', value: true },
          { name: 'CLIENT_USE_V1_QUERY_API', value: true },
        ],
        rowtype: [
          {
            name: 'V1',
            byteLength: null,
            nullable: true,
            precision: null,
            scale: null,
            length: null,
            type: 'variant',
          },
        ],
        rowset: rowset,
        total: rowset.length,
        returned: rowset.length,
        queryId: 'test-variant-query-id',
        databaseProvider: null,
        finalDatabaseName: null,
        finalSchemaName: null,
        finalWarehouseName: 'TEST_WH',
        finalRoleName: 'ACCOUNTADMIN',
        numberOfBinds: 0,
        statementTypeId: 4096,
        version: 0,
      },
      message: null,
      code: null,
      success: true,
    };
  }

  it('parses valid JSON without triggering fallback or telemetry', function (done) {
    const response = createVariantResponse([['{"key": "value"}'], ['[1, 2, 3]']]);
    const requestAsyncSpy = sinon.stub().resolves();
    const resultOptions = ResultTestCommon.createResultOptions(response);
    resultOptions.services = { sf: { requestAsync: requestAsyncSpy } };

    let rowIndex = 0;
    ResultTestCommon.testResult(
      resultOptions,
      function (row) {
        if (rowIndex === 0) {
          assert.deepStrictEqual(row.getColumnValue('V1'), { key: 'value' });
        } else {
          assert.deepStrictEqual(row.getColumnValue('V1'), [1, 2, 3]);
        }
        rowIndex++;
      },
      function () {
        assert.strictEqual(logWarnSpy.callCount, 0);
        assert.strictEqual(requestAsyncSpy.callCount, 0);
        done();
      },
    );
  });

  it('falls back to new Function for non-JSON-compliant values and sends telemetry once', function (done) {
    const response = createVariantResponse([['[1, undefined, 3]'], ['[NaN, Infinity]']]);
    const requestAsyncSpy = sinon.stub().resolves();
    const resultOptions = ResultTestCommon.createResultOptions(response);
    resultOptions.services = { sf: { requestAsync: requestAsyncSpy } };

    let rowIndex = 0;
    ResultTestCommon.testResult(
      resultOptions,
      function (row) {
        const value = row.getColumnValue('V1');
        if (rowIndex === 0) {
          assert.strictEqual(value[0], 1);
          assert.strictEqual(value[1], undefined);
          assert.strictEqual(value[2], 3);
        } else {
          assert.ok(isNaN(value[0]));
          assert.strictEqual(value[1], Infinity);
        }
        rowIndex++;
      },
      function () {
        assert.strictEqual(logWarnSpy.callCount, 2);
        assert.ok(logWarnSpy.getCall(0).args[0].includes('non-JSON-compliant'));
        assert.ok(logWarnSpy.getCall(0).args[0].includes('STRICT_JSON_OUTPUT'));

        // Telemetry sent exactly once despite multiple non-compliant values
        assert.strictEqual(requestAsyncSpy.callCount, 1);
        const telemetryPayload = requestAsyncSpy.getCall(0).args[0];
        assert.strictEqual(telemetryPayload.url, '/telemetry/send');
        assert.strictEqual(
          telemetryPayload.json.logs[0].message.type,
          'selecting_non_json_compliant_variant',
        );
        assert.strictEqual(
          telemetryPayload.json.logs[0].message.value.queryId,
          'test-variant-query-id',
        );
        done();
      },
    );
  });

  it('parses XML without triggering fallback warning or telemetry', function (done) {
    const response = createVariantResponse([['<root><child>value</child></root>']]);
    const requestAsyncSpy = sinon.stub().resolves();
    const resultOptions = ResultTestCommon.createResultOptions(response);
    resultOptions.services = { sf: { requestAsync: requestAsyncSpy } };

    ResultTestCommon.testResult(
      resultOptions,
      function (row) {
        const value = row.getColumnValue('V1');
        assert.ok(value.root);
      },
      function () {
        assert.strictEqual(logWarnSpy.callCount, 0);
        assert.strictEqual(requestAsyncSpy.callCount, 0);
        done();
      },
    );
  });

  it('includes column name in the warning message', function (done) {
    const response = createVariantResponse([['[undefined]']]);
    const requestAsyncSpy = sinon.stub().resolves();
    const resultOptions = ResultTestCommon.createResultOptions(response);
    resultOptions.services = { sf: { requestAsync: requestAsyncSpy } };

    ResultTestCommon.testResult(
      resultOptions,
      function (row) {
        row.getColumnValue('V1');
      },
      function () {
        assert.strictEqual(logWarnSpy.callCount, 1);
        const warnMessage = logWarnSpy.getCall(0).args.join(' ');
        assert.ok(
          warnMessage.includes('V1'),
          `Expected column name "V1" in warning: ${warnMessage}`,
        );
        done();
      },
    );
  });

  it('works with custom parser that ignores the second argument', function (done) {
    GlobalConfig.jsonColumnVariantParser = (rawColumnValue) => JSON.parse(rawColumnValue);

    const response = createVariantResponse([['{"a": 1}']]);
    const requestAsyncSpy = sinon.stub().resolves();
    const resultOptions = ResultTestCommon.createResultOptions(response);
    resultOptions.services = { sf: { requestAsync: requestAsyncSpy } };

    ResultTestCommon.testResult(
      resultOptions,
      function (row) {
        assert.deepStrictEqual(row.getColumnValue('V1'), { a: 1 });
      },
      function () {
        assert.strictEqual(logWarnSpy.callCount, 0);
        assert.strictEqual(requestAsyncSpy.callCount, 0);
        done();
      },
    );
  });
});
