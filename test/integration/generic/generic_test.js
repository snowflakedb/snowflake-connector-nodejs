const assert = require('assert');
const generic = require('../../../build/Release/generic_driver');

describe.only('test generic binding', () => {
  it('should get libsfclient version', () => {
    assert.equal(generic.getVersion(), '1.0.9');
  });

  it('should get api name', () => {
    assert.equal(generic.getApiName(), 'C API');
  });

  it('should return error when connect without parameters', () => {
    assert.equal(generic.connect(), 240016);
  });

  it('should return error when connect without parameters', () => {
    // const connectionParams = { user: process.env.SNOWFLAKE_TEST_USER, password: process.env.SNOWFLAKE_TEST_PASSWORD };
    assert.equal(generic.connectUserPassword(process.env.SNOWFLAKE_TEST_USER, process.env.SNOWFLAKE_TEST_PASSWORD), 0);
  });
});
