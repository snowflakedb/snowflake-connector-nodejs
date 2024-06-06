const assert = require('assert');
const generic = require('../../../lib/generic');

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
    generic.init('FATAL');
  });

  it('should get libsfclient version', () => {
    assert.equal(generic.getVersion(), '1.0.11');
  });

  it('should get api name', () => {
    assert.equal(generic.getApiName(), 'C API');
  });

  it('should connect to snowflake and execute simple query', () => {
    const connectionId = generic.connectUserPassword(connectionParams);
    const result = generic.executeQuery(connectionId, 'select 42, \'bla\', 1.56, \'\', null;');
    assert.deepEqual(result, [[42, 'bla', 1.56, '', null]]);
    generic.closeConnection(connectionId);
  });

  it('should return null when connect failed', () => {
    const connectionId = generic.connectUserPassword({ ...connectionParams, password: 'bla' });
    assert.equal(connectionId, null);
  });

  [10, 10000, 1000000].forEach(sourceRowCount => {
    ['JSON', 'ARROW'].forEach(resultFormat => {
      it(`should select ${sourceRowCount} rows in ${resultFormat}`, () => {
        const connectionId = generic.connectUserPassword(connectionParams);
        const result = generic.executeQuery(connectionId,
          `select randstr(10, random())
           from table (generator(rowcount =>${sourceRowCount}))`,
          { resultFormat });
        assert.equal(result.length, sourceRowCount);
        result.forEach(row => {
          assert.ok(row);
          assert.equal(row.length, 1);
          assert.ok(row[0]);
        });
        generic.closeConnection(connectionId);
      });

      it(`should select ${sourceRowCount} rows in ${resultFormat} with delayed rows fetch`, () => {
        const streamRowsSize = 1000;
        const connectionId = generic.connectUserPassword(connectionParams);
        const statementId = generic.executeQueryWithoutFetchingRows(connectionId,
          `select randstr(10, random())
           from table (generator(rowcount =>${sourceRowCount}))`,
          { resultFormat });
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
        generic.closeConnection(connectionId);
      });

      it(`should select ${sourceRowCount} rows in ${resultFormat} with streaming`, () => {
        const connectionId = generic.connectUserPassword(connectionParams);
        let fetchedRows = 0;
        let invalidRows = 0;
        const options = {
          resultFormat,
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
        generic.closeConnection(connectionId);
      });
    });
  });
});

describe.only('test standard nodejs', () => {
  const snowflake = require('../../../lib/snowflake');
  const testUtil = require('./../testUtil');

  let connectionParams = {};

  before(() => {
    connectionParams = {
      username: process.env.SNOWFLAKE_TEST_USER,
      password: process.env.SNOWFLAKE_TEST_PASSWORD,
      account: process.env.SNOWFLAKE_TEST_ACCOUNT,
      database: process.env.SNOWFLAKE_TEST_DATABASE,
      schema: process.env.SNOWFLAKE_TEST_SCHEMA,
      warehouse: process.env.SNOWFLAKE_TEST_WAREHOUSE,
    };
  });

  [10, 10000, 1000000].forEach(sourceRowCount => {
    ['JSON'].forEach(resultFormat => {
      it(`should select ${sourceRowCount} rows in ${resultFormat}`, async () => {
        const connection = snowflake.createConnection(connectionParams);
        await testUtil.connectAsync(connection);
        const result = await testUtil.executeCmdAsync(connection,
          `select randstr(10, random()) as a
           from table (generator(rowcount =>${sourceRowCount}))`,
        );
        assert.equal(result.length, sourceRowCount);
        result.forEach(row => {
          assert.ok(row);
          assert.ok(row['A']);
        });
        await testUtil.destroyConnectionAsync(connection);
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

      it(`should select ${sourceRowCount} rows in ${resultFormat} with streaming`, async () => {
        const connection = snowflake.createConnection(connectionParams);
        await testUtil.connectAsync(connection);
        const rowLength = await countRows(connection,
          `select randstr(10, random()) as a
           from table (generator(rowcount =>${sourceRowCount}))`,
          row => row && row['A']);
        assert.equal(rowLength, sourceRowCount);
        await testUtil.destroyConnectionAsync(connection);
      });
    });
  });
});