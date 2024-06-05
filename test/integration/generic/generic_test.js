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
    generic.init('TRACE');
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

  it('should select multiple rows', () => {
    const connectionId = generic.connectUserPassword(connectionParams);
    const sourceRowCount = 10;
    const result = generic.executeQuery(connectionId, `select randstr(10, random())
                                                       from table (generator(rowcount =>${sourceRowCount}))`);
    assert.equal(result.length, sourceRowCount);
    result.forEach(row => {
      assert.ok(row);
      assert.equal(row.length, 1);
      assert.ok(row[0]);
    });
    generic.closeConnection(connectionId);
  });
});