const assert = require('assert');
const generic = require('../../../lib/generic');
const snowflake = require('../../../lib/snowflake');
const testUtil = require('../testUtil');

const repeatTimesPerfRun = 5;

describe.only('test generic binding', () => {
  const connectionParams = {
    username: process.env.SNOWFLAKE_TEST_USER,
    password: process.env.SNOWFLAKE_TEST_PASSWORD,
    account: process.env.SNOWFLAKE_TEST_ACCOUNT,
    database: process.env.SNOWFLAKE_TEST_DATABASE,
    schema: process.env.SNOWFLAKE_TEST_SCHEMA,
    warehouse: process.env.SNOWFLAKE_TEST_WAREHOUSE,
  };

  before(() => {
    generic.init('ERROR');
  });

  it('should get libsfclient version', () => {
    assert.equal(generic.getVersion(), '1.0.11');
  });

  it('should get api name', () => {
    assert.equal(generic.getApiName(), 'C API');
  });

  const changeResultFormat = (resultFormat, connectionId) => {
    const formatSelector = resultFormat === 'ARROW' ? 'ARROW_FORCE' : 'JSON';
    const changeFormatResult = generic.executeQuery(connectionId, 'alter session set C_API_QUERY_RESULT_FORMAT=' + formatSelector);
    assert.deepEqual(changeFormatResult, [['Statement executed successfully.']]);
  };

  ['JSON', 'ARROW'].forEach(resultFormat => {
    it(`should connect to snowflake and execute simple query with result in ${resultFormat}`, () => {
      const connectionId = generic.connectUserPassword(connectionParams);
      changeResultFormat(resultFormat, connectionId);
      const result = generic.executeQuery(connectionId, 'select 42, \'żółć\', 1.56, \'\', null;');
      assert.deepEqual(result, [[42, 'żółć', 1.56, '', null]]);
      generic.closeConnection(connectionId);
    });

    it(`should async connect to snowflake and execute simple query with result in ${resultFormat}`, async () => {
      // TODO only connect is async now
      const connectionId = await generic.connectUserPasswordAsync(connectionParams);
      changeResultFormat(resultFormat, connectionId);
      const result = generic.executeQuery(connectionId, 'select 42, \'żółć\', 1.56, \'\', null;');
      assert.deepEqual(result, [[42, 'żółć', 1.56, '', null]]);
      generic.closeConnection(connectionId);
    });
  });

  it('should return null when connect failed', () => {
    const connectionId = generic.connectUserPassword({ ...connectionParams, password: 'bla' });
    assert.equal(connectionId, null);
  });

  it('should execute queries with bind parameters', () => {
    const connectionId = generic.connectUserPassword(connectionParams);
    let result = generic.executeQuery(connectionId, 'create or replace table generic_1 (id int, data text);');
    assert.deepEqual(result, [['Table GENERIC_1 successfully created.']]);
    result = generic.executeQuery(connectionId, 'insert into generic_1 (id, data) values (?, ?)', {
      binds: [1, 'test żółć']
    });
    assert.deepEqual(result, [[1]], 'insert'); // one inserted row
    result = generic.executeQuery(connectionId, 'select id, data from generic_1 where id = ?', {
      binds: [1]
    });
    assert.deepEqual(result, [[1, 'test żółć']], 'select after insert');
    result = generic.executeQuery(connectionId, 'update generic_1 set data = ? where id = ?', {
      binds: ['test 2', 1]
    });
    assert.deepEqual(result, [[1, 0]], 'update'); // one updated row, 0 number of multi-joined rows updated
    result = generic.executeQuery(connectionId, 'select id, data from generic_1 where id = ?', {
      binds: [1]
    });
    assert.deepEqual(result, [[1, 'test 2']], 'select after update');
    result = generic.executeQuery(connectionId, 'delete from generic_1 where id = ?', {
      binds: [1]
    });
    assert.deepEqual(result, [[1]], 'delete'); // one deleted row
    result = generic.executeQuery(connectionId, 'select id, data from generic_1 where id = ?', {
      binds: [1]
    });
    assert.deepEqual(result, [], 'select after delete');
    generic.closeConnection(connectionId);
  });

  describe('Perf selects', () => {
    ['JSON', 'ARROW'].forEach(resultFormat => {
      let connectionId;
      before(() => {
        connectionId = generic.connectUserPassword(connectionParams);
        changeResultFormat(resultFormat, connectionId);
      });

      after(() => {
        generic.closeConnection(connectionId);
      });

      [10, 10000, 1000000].forEach(sourceRowCount => {
        it(`GENERIC|${sourceRowCount}|${resultFormat}|ROWS|${repeatTimesPerfRun}`, () => {
          for (let i = 0; i < repeatTimesPerfRun; i++) {
            const result = generic.executeQuery(connectionId,
              `select randstr(10, random())
               from table (generator(rowcount =>${sourceRowCount}))`);
            assert.equal(result.length, sourceRowCount);
            result.forEach(row => {
              assert.ok(row);
              assert.equal(row.length, 1);
              assert.ok(row[0]);
            });
          }
        });

        it(`GENERIC|${sourceRowCount}|${resultFormat}|DELAYED|${repeatTimesPerfRun}`, () => {
          for (let i = 0; i < repeatTimesPerfRun; i++) {
            const streamRowsSize = 1000;
            const statementId = generic.executeQueryWithoutFetchingRows(connectionId,
              `select randstr(10, random())
               from table (generator(rowcount =>${sourceRowCount}))`);
            assert.ok(statementId);
            let fetchedRows = 0;
            // eslint-disable-next-line no-constant-condition
            while (true) {
              const { rows, end } = generic.fetchNextRows(connectionId, statementId, streamRowsSize);
              rows.forEach(row => {
                assert.ok(row);
                assert.equal(row.length, 1);
                assert.ok(row[0]);
                ++fetchedRows;
              });
              if (end) {
                break;
              }
            }
            assert.equal(fetchedRows, sourceRowCount);
          }
        });

        it(`GENERIC|${sourceRowCount}|${resultFormat}|STREAM|${repeatTimesPerfRun}`, () => {
          for (let i = 0; i < repeatTimesPerfRun; i++) {
            let fetchedRows = 0;
            let invalidRows = 0;
            const options = {
              handleRow: row => {
                if (row && row.length === 1 && row[0]) {
                  ++fetchedRows;
                } else {
                  ++invalidRows;
                }
              }
            };
            const result = generic.executeQuery(connectionId,
              `select randstr(10, random())
               from table (generator(rowcount =>${sourceRowCount}))`,
              options);
            assert.equal(result.length, 0);
            assert.equal(invalidRows, 0);
            assert.equal(fetchedRows, sourceRowCount);
          }
        });
      });
    });
  });
})
;

describe.only('Perf selects standard nodejs', () => {
  let connection;

  before(async () => {
    const connectionParams = {
      username: process.env.SNOWFLAKE_TEST_USER,
      password: process.env.SNOWFLAKE_TEST_PASSWORD,
      account: process.env.SNOWFLAKE_TEST_ACCOUNT,
      database: process.env.SNOWFLAKE_TEST_DATABASE,
      schema: process.env.SNOWFLAKE_TEST_SCHEMA,
      warehouse: process.env.SNOWFLAKE_TEST_WAREHOUSE,
    };
    connection = snowflake.createConnection(connectionParams);
    await testUtil.connectAsync(connection);
  });

  after(async () => {
    await testUtil.destroyConnectionAsync(connection);
  });

  [10, 10000, 1000000].forEach(sourceRowCount => {
    const resultFormat = 'JSON';

    it(`NODEJS|${sourceRowCount}|${resultFormat}|ROWS|${repeatTimesPerfRun}`, async () => {
      for (let i = 0; i < repeatTimesPerfRun; i++) {
        const result = await testUtil.executeCmdAsync(connection,
          `select randstr(10, random()) as a
           from table (generator(rowcount =>${sourceRowCount}))`,
        );
        assert.equal(result.length, sourceRowCount);
        result.forEach(row => {
          assert.ok(row);
          assert.ok(row['A']);
        });
      }
    });

    const countRows = (connection, sqlText, validateRow) => {
      return new Promise((resolve, reject) => {
        const stmt = connection.execute({
          sqlText: sqlText,
          streamResult: true,
        });
        const stream = stmt.streamRows();
        let rowCount = 0;
        stream.on('data', function (row) {
          if (validateRow(row)) {
            rowCount++;
          } else {
            reject(`Invalid row: ${row}`);
          }
        });
        stream.on('error', function (err) {
          reject(err);
        });
        stream.on('end', function () {
          resolve(rowCount);
        });
      });
    };

    it(`NODEJS|${sourceRowCount}|${resultFormat}|STREAM|${repeatTimesPerfRun}`, async () => {
      for (let i = 0; i < repeatTimesPerfRun; i++) {
        const rowLength = await countRows(connection,
          `select randstr(10, random()) as a
           from table (generator(rowcount =>${sourceRowCount}))`,
          row => row && row['A']);
        assert.equal(rowLength, sourceRowCount);
      }
    });
  });
});