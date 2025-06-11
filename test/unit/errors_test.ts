import assert from 'assert';
import { ErrorCode } from './../../lib/errors';
import * as mapErrCodeToErrMessage from './../../lib/constants/error_messages';
import { mapErrorCodeToSqlState } from './../../lib/errors';

/**
 * Numeric enums have reverse key mapping:
 * "400001": "ERR_INTERNAL_ASSERT_FAILED",
 * "ERR_INTERNAL_ASSERT_FAILED": 400001,
 *
 * Indexing only actual enum keys
*/
const errorNames = Object.keys(ErrorCode).filter(value => !(parseInt(value) > 0)) as (keyof typeof ErrorCode)[];

describe('Errors', function () {
  it('every error name should have an error code and error message', function () {
    for (const errName of errorNames) {
      const errCode = ErrorCode[errName];
      assert.ok(errCode, `missing error code for: ${errName}`);
      assert.ok(mapErrCodeToErrMessage[errCode], `invalid error message for: ${errCode}`);
    }
  });

  it('no two error names should have the same error code', function () {
    const checkedErrorCodes: Record<number, string> = {};
    for (const errName of errorNames) {
      const errCode = ErrorCode[errName];
      assert.ok(!checkedErrorCodes[errCode], `more than one error name for code: ${errCode}`);
      checkedErrorCodes[errCode] = errName;
    }
  });

  it('validate error code to sql state mapping', function () {
    for (const [errCode, sqlState] of Object.entries(mapErrorCodeToSqlState)) {
      assert.ok(errCode in ErrorCode, `invalid mapping: ${errCode}:${sqlState}`);
    }
  });
});
