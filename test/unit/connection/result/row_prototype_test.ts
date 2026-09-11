import assert from 'assert';
import Result from '../../../../lib/connection/result/result';
import ConnectionConfig from '../../../../lib/connection/connection_config';

type InternalRow = {
  _arrayProcessedColumns: boolean[];
  values: unknown[];
  rowIndex: number;
  getRowIndex(): number;
  getStatement(): object;
  getColumnValue(columnIdentifier: string | number): unknown;
  getColumnValueAsString(columnIdentifier: string | number): string | null;
};

function fetchRows(): Promise<InternalRow[]> {
  const statement = {};
  const result = new Result({
    response: {
      data: {
        parameters: [],
        rowtype: [
          {
            name: 'C0',
            byteLength: null,
            nullable: true,
            precision: 38,
            scale: 0,
            length: null,
            type: 'fixed',
          },
          {
            name: 'C1',
            byteLength: null,
            nullable: true,
            precision: 38,
            scale: 0,
            length: null,
            type: 'fixed',
          },
        ],
        rowset: [
          ['0', '1'],
          ['2', '3'],
        ],
        total: 2,
        returned: 2,
        queryId: 'row-prototype-test',
        statementTypeId: 4096,
        version: 1,
      },
      message: null,
      code: null,
      success: true,
    },
    statement,
    services: {},
    connectionConfig: new ConnectionConfig({
      username: 'username',
      password: 'password',
      account: 'account',
      accessUrl: 'https://account.snowflake.com',
    }),
  });

  return new Promise((resolve, reject) => {
    const rows: InternalRow[] = [];
    const operation = result.fetchRows({
      each: (row: InternalRow) => rows.push(row),
    });
    operation.on('complete', (error: Error | undefined) => {
      if (error) {
        reject(error);
      } else {
        resolve(rows);
      }
    });
  });
}

describe('Result row prototype', function () {
  it('shares row methods without changing row behavior', async function () {
    const [firstRow, secondRow] = await fetchRows();

    assert.strictEqual(Object.getPrototypeOf(firstRow), Object.getPrototypeOf(secondRow));
    assert.strictEqual(firstRow.getRowIndex, secondRow.getRowIndex);
    assert.strictEqual(firstRow.getStatement, secondRow.getStatement);
    assert.strictEqual(firstRow.getColumnValue, secondRow.getColumnValue);
    assert.strictEqual(firstRow.getColumnValueAsString, secondRow.getColumnValueAsString);

    assert.strictEqual(firstRow.getRowIndex(), 0);
    assert.strictEqual(secondRow.getRowIndex(), 1);
    assert.strictEqual(firstRow.getStatement(), secondRow.getStatement());
    assert.strictEqual(firstRow.getColumnValue('C1'), 1);
    assert.strictEqual(secondRow.getColumnValueAsString(0), '2');

    assert.ok(!Object.prototype.hasOwnProperty.call(firstRow, 'getColumnValue'));
    assert.deepStrictEqual(Object.keys(firstRow), ['_arrayProcessedColumns', 'values', 'rowIndex']);
  });
});
