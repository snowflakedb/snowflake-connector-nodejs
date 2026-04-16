import assert from 'assert';
import { EventEmitter } from 'events';
import { Readable } from 'stream';
import RowStream from '../../../../lib/connection/result/row_stream';
import ConnectionConfig from '../../../../lib/connection/connection_config';

describe('RowStream', function () {
  const mandatoryConnectionOptions = {
    username: 'username',
    password: 'password',
    account: 'account',
  };

  function createRowStream(connectionConfig: InstanceType<typeof ConnectionConfig>) {
    const statement = { getColumns: () => [] };
    const context = { connectionConfig };
    return new RowStream(statement, context) as unknown as Readable;
  }

  it('uses default rowStreamHighWaterMark of 10', function () {
    const config = new ConnectionConfig(mandatoryConnectionOptions);
    const stream = createRowStream(config);
    assert.strictEqual(stream.readableHighWaterMark, 10);
  });

  it('uses custom rowStreamHighWaterMark when passed in connection config', function () {
    const config = new ConnectionConfig({
      ...mandatoryConnectionOptions,
      rowStreamHighWaterMark: 25,
    });
    const stream = createRowStream(config);
    assert.strictEqual(stream.readableHighWaterMark, 25);
  });

  describe('chunk memory management', function () {
    // Minimal mock row with the extract function RowStream expects
    function mockRow(value: string) {
      return { getColumnValue: () => value, getColumnValueAsString: () => value };
    }

    function createMockChunk(
      id: number,
      startIndex: number,
      rows: ReturnType<typeof mockRow>[],
      callLog: string[],
    ) {
      const emitter = new EventEmitter();
      let loading = false;

      const chunk = Object.assign(emitter, {
        _url: 'https://s3.snowflake.com/chunk',
        getStartIndex: () => startIndex,
        getEndIndex: () => startIndex + rows.length - 1,
        getRows: () => {
          callLog.push(`chunk${id}:getRows`);
          return rows;
        },
        clearRows: () => {
          callLog.push(`chunk${id}:clearRows`);
        },
        getId: () => id,
        isLoading: () => loading,
        load: function () {
          loading = true;
          process.nextTick(() => {
            loading = false;
            emitter.emit('loadcomplete', null, chunk);
          });
        },
      });

      return chunk;
    }

    function createStreamWithChunks(
      chunkDefs: { rows: ReturnType<typeof mockRow>[] }[],
      highWaterMark = 1000,
    ) {
      const callLog: string[] = [];

      let totalRows = 0;
      const chunks = chunkDefs.map((def, i) => {
        const chunk = createMockChunk(i, totalRows, def.rows, callLog);
        totalRows += def.rows.length;
        return chunk;
      });

      const statement = {
        getColumns: () => [{ getId: () => 0, getName: () => 'col', getType: () => 'TEXT' }],
      };
      const context = {
        connectionConfig: new ConnectionConfig({
          ...mandatoryConnectionOptions,
          rowStreamHighWaterMark: highWaterMark,
        }),
        result: {
          getReturnedRows: () => totalRows,
          findOverlappingChunks: () => chunks,
        },
        isFetchingResult: false,
        rowMode: undefined,
        fetchAsString: undefined,
      };

      const stream = new RowStream(statement, context) as unknown as Readable;
      return { stream, callLog, chunks };
    }

    it('clears previous chunk rows before parsing the new chunk', function (done) {
      const { stream, callLog } = createStreamWithChunks([
        { rows: [mockRow('a'), mockRow('b')] },
        { rows: [mockRow('c'), mockRow('d')] },
      ]);

      const received: string[] = [];
      stream.on('data', (row: Record<string, string>) => received.push(row.col));
      stream.on('end', () => {
        // chunk0:getRows must come first (initial chunk)
        // chunk0:clearRows must come BEFORE chunk1:getRows
        const getRows0 = callLog.indexOf('chunk0:getRows');
        const clearRows0 = callLog.indexOf('chunk0:clearRows');
        const getRows1 = callLog.indexOf('chunk1:getRows');

        assert.ok(getRows0 >= 0, 'chunk0:getRows should be called');
        assert.ok(clearRows0 >= 0, 'chunk0:clearRows should be called');
        assert.ok(getRows1 >= 0, 'chunk1:getRows should be called');
        assert.ok(
          clearRows0 < getRows1,
          `clearRows on chunk 0 (index ${clearRows0}) should be called before ` +
            `getRows on chunk 1 (index ${getRows1}), callLog: ${callLog.join(', ')}`,
        );

        assert.deepStrictEqual(received, ['a', 'b', 'c', 'd']);

        // last chunk should also be cleaned up during close()
        assert.ok(callLog.includes('chunk1:clearRows'), 'last chunk should be cleared on close');
        done();
      });
      stream.on('error', done);
    });

    it('delivers all rows correctly under backpressure (highWaterMark=1)', function (done) {
      const { stream, callLog } = createStreamWithChunks(
        [
          { rows: [mockRow('a'), mockRow('b'), mockRow('c'), mockRow('d')] },
          { rows: [mockRow('e'), mockRow('f')] },
        ],
        1,
      );

      const received: string[] = [];
      stream.on('data', (row: Record<string, string>) => received.push(row.col));
      stream.on('end', () => {
        assert.deepStrictEqual(received, ['a', 'b', 'c', 'd', 'e', 'f']);
        assert.ok(
          callLog.indexOf('chunk0:clearRows') < callLog.indexOf('chunk1:getRows'),
          'clearRows ordering must hold under backpressure',
        );
        done();
      });
      stream.on('error', done);
    });
  });
});
