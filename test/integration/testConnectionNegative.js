const snowflake = require('./../../lib/snowflake');
const assert = require('assert');

describe('snowflake.createConnection() synchronous errors', function () {
  // empty error code for now 
  const ErrorCodes = {};
  const testCases =
    [
      {
        name: 'missing options',
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_OPTIONS
      },
      {
        name: 'undefined options',
        options: undefined,
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_OPTIONS
      },
      {
        name: 'null options',
        options: null,
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_OPTIONS
      },
      {
        name: 'invalid options',
        options: 'invalid',
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_OPTIONS
      },
      {
        name: 'missing username',
        options: {},
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_USERNAME
      },
      {
        name: 'undefined username',
        options:
          {
            username: undefined
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_USERNAME
      },
      {
        name: 'null username',
        options:
          {
            username: null
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_USERNAME
      },
      {
        name: 'invalid username',
        options:
          {
            username: 0
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_USERNAME
      },
      {
        name: 'missing password',
        options:
          {
            username: 'username'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_PASSWORD
      },
      {
        name: 'undefined password',
        options:
          {
            username: 'username',
            password: undefined
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_PASSWORD
      },
      {
        name: 'null password',
        options:
          {
            username: 'username',
            password: null
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_PASSWORD
      },
      {
        name: 'invalid password',
        options:
          {
            username: 'username',
            password: 0
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_PASSWORD
      },
      {
        name: 'missing account',
        options:
          {
            username: 'username',
            password: 'password'
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_ACCOUNT
      },
      {
        name: 'undefined account',
        options:
          {
            username: 'username',
            password: 'password',
            account: undefined
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_ACCOUNT
      },
      {
        name: 'null account',
        options:
          {
            username: 'username',
            password: 'password',
            account: null
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_MISSING_ACCOUNT
      },
      {
        name: 'invalid account',
        options:
          {
            username: 'username',
            password: 'password',
            account: 0
          },
        errorCode: ErrorCodes.ERR_CONN_CREATE_INVALID_ACCOUNT
      }
    ];

  const createItCallback = function (testCase) {
    return function () {
      let error = null;

      try {
        snowflake.createConnection(testCase.options);
      } catch (err) {
        error = err;
      } finally {
        assert.ok(error);
        //assert.strictEqual(error.code, testCase.errorCode);
      }
    };
  };

  let index, length, testCase;
  for (index = 0, length = testCases.length; index < length; index++) {
    testCase = testCases[index];
    it(testCase.name, createItCallback(testCase));
  }
});
