/*
 * Copyright (c) 2015 Snowflake Computing Inc. All rights reserved.
 */

var mapErrNameToErrCode = require('./../../lib/errors').codes;
var mapErrCodeToErrMessage = require('./../../lib/constants/error_messages');
var mapErrCodeToSqlState = require('./../../lib/errors').mapErrorCodeToSqlState;
var assert = require('assert');

describe('Errors', function () {
  it('every error name should have an error code and error message', function () {
    var errName;
    var errCode;

    for (errName in mapErrNameToErrCode) {
      if (Object.prototype.hasOwnProperty.call(mapErrNameToErrCode, errName)) {
        errCode = mapErrNameToErrCode[errName];

        assert.ok(errCode, 'missing error code for: ' + errName);

        assert.ok(Object.prototype.hasOwnProperty.call(mapErrCodeToErrMessage, errCode),
          'missing error message for: ' + errCode);
        assert.ok(mapErrCodeToErrMessage[errCode],
          'invalid error message for: ' + errCode);
      }
    }
  });

  it('no two error names should have the same error code', function () {
    // make sure the mapping from error-name to error-code is one-to-one
    var mapErrCodeToErrName = {};
    var errName, errCode;
    for (errName in mapErrNameToErrCode) {
      if (Object.prototype.hasOwnProperty.call(mapErrNameToErrCode, errName)) {
        errCode = mapErrNameToErrCode[errName];

        assert.ok(!Object.prototype.hasOwnProperty.call(mapErrCodeToErrName, errCode),
          'more than one error name for code: ' + errCode);

        mapErrCodeToErrName[errCode] = errName;
      }
    }
  });

  it('validate error code to sql state mapping', function () {
    var mapErrCodeToErrName = {};
    for (var errName in mapErrNameToErrCode) {
      if (Object.prototype.hasOwnProperty.call(mapErrNameToErrCode, errName)) {
        mapErrCodeToErrName[mapErrNameToErrCode[errName]] = errName;
      }
    }

    for (var errCode in mapErrCodeToSqlState) {
      if (Object.prototype.hasOwnProperty.call(mapErrCodeToSqlState, errCode)) {
        assert.ok(mapErrCodeToErrName[errCode],
          'invalid mapping: ' + errCode + ':' +
          mapErrCodeToSqlState[errCode]);
      }
    }
  });
});