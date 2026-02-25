import assert from 'assert';
import { ErrorCode } from '../../lib/errors';
const snowflake = require('./../../lib/snowflake').default;

describe('snowflake.createConnection() synchronous errors', function () {
  const testCases = [
    {
      name: 'missing options',
      errorCode: ErrorCode.ERR_CONN_CREATE_MISSING_OPTIONS,
    },
    {
      name: 'undefined options',
      options: undefined,
      errorCode: ErrorCode.ERR_CONN_CREATE_MISSING_OPTIONS,
    },
    {
      name: 'null options',
      options: null,
      errorCode: ErrorCode.ERR_CONN_CREATE_MISSING_OPTIONS,
    },
    {
      name: 'invalid options',
      options: 'invalid',
      errorCode: ErrorCode.ERR_CONN_CREATE_INVALID_OPTIONS,
    },
    {
      name: 'missing username',
      options: {},
      errorCode: ErrorCode.ERR_CONN_CREATE_MISSING_USERNAME,
    },
    {
      name: 'undefined username',
      options: {
        username: undefined,
      },
      errorCode: ErrorCode.ERR_CONN_CREATE_MISSING_USERNAME,
    },
    {
      name: 'null username',
      options: {
        username: null,
      },
      errorCode: ErrorCode.ERR_CONN_CREATE_MISSING_USERNAME,
    },
    {
      name: 'invalid username',
      options: {
        username: 0,
      },
      errorCode: ErrorCode.ERR_CONN_CREATE_INVALID_USERNAME,
    },
    {
      name: 'missing password',
      options: {
        username: 'username',
      },
      errorCode: ErrorCode.ERR_CONN_CREATE_MISSING_PASSWORD,
    },
    {
      name: 'undefined password',
      options: {
        username: 'username',
        password: undefined,
      },
      errorCode: ErrorCode.ERR_CONN_CREATE_MISSING_PASSWORD,
    },
    {
      name: 'null password',
      options: {
        username: 'username',
        password: null,
      },
      errorCode: ErrorCode.ERR_CONN_CREATE_MISSING_PASSWORD,
    },
    {
      name: 'invalid password',
      options: {
        username: 'username',
        password: 0,
      },
      errorCode: ErrorCode.ERR_CONN_CREATE_INVALID_PASSWORD,
    },
    {
      name: 'missing account',
      options: {
        username: 'username',
        password: 'password',
      },
      errorCode: ErrorCode.ERR_CONN_CREATE_MISSING_ACCOUNT,
    },
    {
      name: 'undefined account',
      options: {
        username: 'username',
        password: 'password',
        account: undefined,
      },
      errorCode: ErrorCode.ERR_CONN_CREATE_MISSING_ACCOUNT,
    },
    {
      name: 'null account',
      options: {
        username: 'username',
        password: 'password',
        account: null,
      },
      errorCode: ErrorCode.ERR_CONN_CREATE_MISSING_ACCOUNT,
    },
    {
      name: 'invalid account',
      options: {
        username: 'username',
        password: 'password',
        account: 0,
      },
      errorCode: ErrorCode.ERR_CONN_CREATE_INVALID_ACCOUNT,
    },
  ];

  for (const testCase of testCases) {
    it(testCase.name, () => {
      assert.throws(
        () => snowflake.createConnection(testCase.options),
        (err: any) => err.code === testCase.errorCode,
      );
    });
  }
});
