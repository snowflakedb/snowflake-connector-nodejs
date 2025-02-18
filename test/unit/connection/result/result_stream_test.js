const ResultStream = require('./../../../../lib/connection/result/result_stream');
const ErrorCodes = require('./../../../../lib/errors').codes;
const assert = require('assert');

describe('ResultStream: basic', function () {
  ///////////////////////////////////////////////////////////////////////////
  //// Test synchronous errors                                           ////
  ///////////////////////////////////////////////////////////////////////////

  const testCases =
    [
      {
        name: 'missing options',
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'undefined options',
        options: undefined,
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'null options',
        options: null,
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'invalid options',
        options: 'invalid',
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'missing chunks',
        options: {},
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'undefined chunks',
        options:
          {
            chunks: undefined
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'null chunks',
        options:
          {
            chunks: null
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'invalid chunks',
        options:
          {
            chunks: 'invalid'
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'missing prefetchSize',
        options:
          {
            chunks: []
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'undefined prefetchSize',
        options:
          {
            chunks: [],
            prefetchSize: undefined
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'null prefetchSize',
        options:
          {
            chunks: [],
            prefetchSize: null
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'invalid prefetchSize (wrong type)',
        options:
          {
            chunks: [],
            prefetchSize: 'invalid'
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      },
      {
        name: 'invalid prefetchSize (negative)',
        options:
          {
            chunks: [],
            prefetchSize: -1
          },
        errorCode: ErrorCodes.ERR_INTERNAL_ASSERT_FAILED
      }
    ];

  const createItCallback = function (testCase) {
    return function () {
      let error;

      try {
        new ResultStream(testCase.options);
      } catch (err) {
        error = err;
      } finally {
        assert.ok(error);
        assert.strictEqual(error.code, testCase.errorCode);
      }
    };
  };

  let index, length, testCase;
  for (index = 0, length = testCases.length; index < length; index++) {
    testCase = testCases[index];
    it(testCase.name, createItCallback(testCase));
  }

  ///////////////////////////////////////////////////////////////////////////
  //// Test valid arguments                                              ////
  ///////////////////////////////////////////////////////////////////////////

  it('valid result stream', function () {
    const resultStream = new ResultStream(
      {
        chunks: [],
        prefetchSize: 1
      });

    assert.ok(resultStream, 'should be a valid ResultStream');
  });
});