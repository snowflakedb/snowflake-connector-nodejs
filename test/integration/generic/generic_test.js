const assert = require('assert');
const generic = require('../../../build/Release/generic_driver');

describe.only('test generic binding', () => {
  it('should get libsfclient version', () => {
    assert.equal(generic.getVersion(), '1.0.9');
  });

  it('should get api name', () => {
    assert.equal(generic.getApiName(), 'C API');
  });

  it('should connect to snowflake', () => {
    const connectionParams = {
      user: process.env.SNOWFLAKE_TEST_USER,
      password: process.env.SNOWFLAKE_TEST_PASSWORD,
      account: process.env.SNOWFLAKE_TEST_ACCOUNT,
      database: process.env.SNOWFLAKE_TEST_DATABASE,
    };
    assert.equal(generic.connectUserPassword(connectionParams), 0);
  });
});
