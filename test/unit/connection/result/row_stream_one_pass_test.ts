import assert from 'assert';
import { Readable } from 'stream';
import Result from '../../../../lib/connection/result/result';
import RowStream from '../../../../lib/connection/result/row_stream';
import ConnectionConfig from '../../../../lib/connection/connection_config';

type InternalRow = {
  _arrayProcessedColumns: boolean[];
  values: unknown[];
  getColumnValue(columnIdentifier: string | number): unknown;
  getColumnValueAsString(columnIdentifier: string | number): string | null;
};

const ROWTYPE = [
  { name: 'ID', type: 'fixed', precision: 38, scale: 0 },
  { name: 'AMOUNT', type: 'fixed', precision: 7, scale: 2 },
  { name: 'NAME', type: 'text', length: 32 },
  { name: 'ACTIVE', type: 'boolean' },
  { name: 'CREATED', type: 'date' },
  { name: 'TS', type: 'timestamp_ntz', scale: 9 },
  { name: 'T', type: 'time', scale: 9 },
  { name: 'BIN', type: 'binary' },
  { name: 'V', type: 'variant' },
].map((column) => ({
  byteLength: null,
  nullable: true,
  precision: null,
  scale: null,
  length: null,
  ...column,
}));

const ROWSET = [
  ['1', '12.34', 'alice', 'true', '19000', '1700000000.123456789', '3661.5', '0a0b', '{"k":1}'],
  [null, null, null, null, null, null, null, null, null],
  ['4294967297', '0.01', 'bob', 'false', '0', '0.000000000', '0.0', 'ff', '[1,2]'],
];

function buildResult() {
  const connectionConfig = new ConnectionConfig({
    username: 'username',
    password: 'password',
    account: 'account',
    accessUrl: 'https://account.snowflake.com',
  });
  const result = new Result({
    response: {
      data: {
        parameters: [
          { name: 'TIMEZONE', value: 'UTC' },
          { name: 'TIMESTAMP_OUTPUT_FORMAT', value: 'YYYY-MM-DD HH24:MI:SS.FF9' },
          { name: 'TIMESTAMP_NTZ_OUTPUT_FORMAT', value: '' },
          { name: 'DATE_OUTPUT_FORMAT', value: 'YYYY-MM-DD' },
          { name: 'TIME_OUTPUT_FORMAT', value: 'HH24:MI:SS.FF9' },
          { name: 'BINARY_OUTPUT_FORMAT', value: 'HEX' },
        ],
        rowtype: ROWTYPE,
        // copied: the cached getters write converted values back into these arrays
        rowset: ROWSET.map((row) => row.slice()),
        total: ROWSET.length,
        returned: ROWSET.length,
        queryId: 'row-stream-one-pass-test',
        statementTypeId: 4096,
        version: 1,
      },
      message: null,
      code: null,
      success: true,
    },
    statement: {},
    services: {},
    connectionConfig,
  });
  return { result, connectionConfig };
}

type ResultColumn = { getName(): string; getId(): number };

function internalRows(result: InstanceType<typeof Result>): InternalRow[] {
  return result.findOverlappingChunks(0, ROWSET.length - 1)[0].getRows() as InternalRow[];
}

function resultColumns(result: InstanceType<typeof Result>): ResultColumn[] {
  return result.getColumns() as ResultColumn[];
}

function streamAll(
  built: ReturnType<typeof buildResult>,
  options: { fetchAsString?: string[]; rowMode?: string } = {},
): Promise<Record<string, unknown>[]> {
  const statement = { getColumns: () => built.result.getColumns() };
  const context = {
    connectionConfig: built.connectionConfig,
    result: built.result,
    isFetchingResult: false,
    rowMode: options.rowMode,
    fetchAsString: options.fetchAsString,
  };
  const stream = new RowStream(statement, context, {
    fetchAsString: options.fetchAsString,
  }) as unknown as Readable;
  return new Promise((resolve, reject) => {
    const rows: Record<string, unknown>[] = [];
    stream.on('data', (row) => rows.push(row));
    stream.on('end', () => resolve(rows));
    stream.on('error', reject);
  });
}

// JSON form is enough to compare Date / Buffer / SfTime values between the two paths
function canonical(value: unknown) {
  return JSON.stringify(value, (_key, v) => (typeof v === 'bigint' ? v.toString() + 'n' : v));
}

describe('RowStream one-pass extraction', function () {
  it('emits the same values as the cached row getters', async function () {
    const streamed = await streamAll(buildResult());
    const cached = internalRows(buildResult().result);
    const columns = resultColumns(buildResult().result);

    assert.strictEqual(streamed.length, ROWSET.length);
    streamed.forEach((row, rowIndex) => {
      columns.forEach((column) => {
        assert.strictEqual(
          canonical(row[column.getName()]),
          canonical(cached[rowIndex].getColumnValue(column.getId())),
          `row ${rowIndex} column ${column.getName()}`,
        );
      });
    });
  });

  it('emits the same strings as the cached row getters with fetchAsString', async function () {
    const fetchAsString = ['Number', 'Date', 'JSON', 'Boolean', 'Buffer', 'String'];
    const streamed = await streamAll(buildResult(), { fetchAsString });
    const cached = internalRows(buildResult().result);
    const columns = resultColumns(buildResult().result);

    streamed.forEach((row, rowIndex) => {
      columns.forEach((column) => {
        assert.strictEqual(
          row[column.getName()],
          cached[rowIndex].getColumnValueAsString(column.getId()),
          `row ${rowIndex} column ${column.getName()}`,
        );
      });
    });
  });

  it('supports array row mode', async function () {
    const streamed = await streamAll(buildResult(), { rowMode: 'array' });
    assert.ok(Array.isArray(streamed[0]));
    assert.strictEqual(streamed[0][0], 1);
    assert.strictEqual(streamed[0][2], 'alice');
    assert.strictEqual(streamed[1][0], null);
  });

  it('leaves the internal rows unconverted after streaming', async function () {
    const built = buildResult();
    const rows = internalRows(built.result);
    await streamAll(built);

    rows.forEach((row, rowIndex) => {
      assert.deepStrictEqual(row.values, ROWSET[rowIndex]);
      assert.deepStrictEqual(row._arrayProcessedColumns, []);
    });

    // the cached getters still work on the same rows afterwards
    assert.strictEqual(rows[0].getColumnValue('ID'), 1);
    assert.strictEqual(rows[2].getColumnValueAsString('ID'), '4294967297');
    assert.strictEqual(rows[0]._arrayProcessedColumns[0], true);
  });

  it('reads cells already converted by the cached getters through the cache', async function () {
    const built = buildResult();
    const rows = internalRows(built.result);
    const preRead = rows.map((row) => [
      row.getColumnValue('ID'),
      row.getColumnValueAsString('V'),
      row.getColumnValue('CREATED'),
    ]);

    const streamed = await streamAll(built);
    streamed.forEach((row, rowIndex) => {
      assert.strictEqual(row.ID, preRead[rowIndex][0]);
      assert.strictEqual(canonical(row.V), canonical(rows[rowIndex].getColumnValue('V')));
      assert.strictEqual(canonical(row.CREATED), canonical(preRead[rowIndex][2]));
    });

    const streamedAsString = await streamAll(built, { fetchAsString: ['JSON', 'Number'] });
    streamedAsString.forEach((row, rowIndex) => {
      assert.strictEqual(row.ID, rows[rowIndex].getColumnValueAsString('ID'));
      assert.strictEqual(row.V, rows[rowIndex].getColumnValueAsString('V'));
    });
  });
});
