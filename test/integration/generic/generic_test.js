const assert = require('assert');
const generic = require('../../../lib/generic');
const { setTimestampOutputFormat } = require('../sharedStatements');

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
    assert.equal(generic.getVersion(), '1.0.9');
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

  [10, 10000, 1000000, 10000000].forEach(sourceRowCount => {
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

      it(`should select ${sourceRowCount} rows in ${resultFormat} with streaming`, () => {
        const streamRowsSize = 1000;
        const connectionId = generic.connectUserPassword(connectionParams);
        const statementId = generic.executeQueryStreaming(connectionId,
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
    });
  });
});
