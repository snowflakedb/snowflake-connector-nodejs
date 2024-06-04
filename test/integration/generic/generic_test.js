const assert = require('assert');
const generic = require('../../../build/Release/generic_driver');

describe.only('test generic binding', () => {
  it('should get libsfclient version', () => {
    assert.equal(generic.getVersion(), '1.0.9');
  });

  it('should get api name', () => {
    assert.equal(generic.getApiName(), 'C API');
  });

  it('should connect to snowflake and execute simple query', () => {
    const connectionParams = {
      user: process.env.SNOWFLAKE_TEST_USER,
      password: process.env.SNOWFLAKE_TEST_PASSWORD,
      account: process.env.SNOWFLAKE_TEST_ACCOUNT,
      database: process.env.SNOWFLAKE_TEST_DATABASE,
    };
    const connectionId = generic.connectUserPassword(connectionParams);
    const result = generic.executeQuery(connectionId, 'select 42, \'bla\', 1.56;');
    // TODO test null
    assert.deepEqual(result, [[42, 'bla', 1.56]]);
  });

  it('should return null when connect failed', () => {
    const connectionParams = {
      user: process.env.SNOWFLAKE_TEST_USER,
      password: 'invalid',
      account: process.env.SNOWFLAKE_TEST_ACCOUNT,
      database: process.env.SNOWFLAKE_TEST_DATABASE,
    };
    const connectionId = generic.connectUserPassword(connectionParams);
    assert.equal(connectionId, null);
  });

  it('should select multiple rows', () => {
    const connectionParams = {
      user: process.env.SNOWFLAKE_TEST_USER,
      password: process.env.SNOWFLAKE_TEST_PASSWORD,
      account: process.env.SNOWFLAKE_TEST_ACCOUNT,
      database: process.env.SNOWFLAKE_TEST_DATABASE,
    };
    const connectionId = generic.connectUserPassword(connectionParams);
    const sourceRowCount = 10;
    const result = generic.executeQuery(connectionId, `select randstr(10, random()) from table (generator(rowcount =>${sourceRowCount}))`);
    assert.equal(result.length, sourceRowCount);
    result.forEach(row => {
      assert.ok(row);
      assert.equal(row.length, 1);
      assert.ok(row[0]);
    });
  });
});
