/*
 * Copyright (c) 2015 Snowflake Computing Inc. All rights reserved.
 */

var Util = require('./../../lib/util');
var assert = require('assert');

describe('Util', function ()
{
  it('Util.isFunction()', function ()
  {
    // positive tests
    assert.ok(Util.isFunction(function ()
    {
    }));
    assert.ok(Util.isFunction(new Function()));

    // negative tests
    assert.ok(!Util.isFunction(null));
    assert.ok(!Util.isFunction(undefined));
    assert.ok(!Util.isFunction(0));
    assert.ok(!Util.isFunction(1));
    assert.ok(!Util.isFunction(''));
    assert.ok(!Util.isFunction('foo'));
    assert.ok(!Util.isFunction(new Date()));
    assert.ok(!Util.isFunction({}));
    assert.ok(!Util.isFunction(new Object()));
  });

  it('Util.isObject()', function ()
  {
    // positive tests
    assert.ok(Util.isObject({}));
    assert.ok(Util.isObject(new Object()));

    // negative tests
    assert.ok(!Util.isObject(null));
    assert.ok(!Util.isObject(undefined));
    assert.ok(!Util.isObject(0));
    assert.ok(!Util.isObject(1));
    assert.ok(!Util.isObject(''));
    assert.ok(!Util.isObject('foo'));
    assert.ok(!Util.isObject(new Date()));
    assert.ok(!Util.isObject(function ()
    {
    }));
    assert.ok(!Util.isObject(new Function()));
  });

  it('Util.isDate()', function ()
  {
    // positive tests
    assert.ok(Util.isDate(new Date()));

    // negative tests
    assert.ok(!Util.isDate({}));
    assert.ok(!Util.isDate(new Object()));
    assert.ok(!Util.isDate(null));
    assert.ok(!Util.isDate(undefined));
    assert.ok(!Util.isDate(0));
    assert.ok(!Util.isDate(1));
    assert.ok(!Util.isDate(''));
    assert.ok(!Util.isDate('foo'));
    assert.ok(!Util.isDate(function ()
    {
    }));
    assert.ok(!Util.isDate(new Function()));
  });

  it('isArray()', function ()
  {
    // positive tests
    assert.ok(Util.isArray([]));
    assert.ok(Util.isArray([1]));
    assert.ok(Util.isArray(new Array()));

    // negative tests
    assert.ok(!Util.isArray(null));
    assert.ok(!Util.isArray(undefined));
    assert.ok(!Util.isArray(0));
    assert.ok(!Util.isArray(1));
    assert.ok(!Util.isArray(''));
    assert.ok(!Util.isArray('foo'));
    assert.ok(!Util.isArray(new Date()));
    assert.ok(!Util.isArray({}));
    assert.ok(!Util.isArray(new Object()));
    assert.ok(!Util.isArray(function ()
    {
    }));
    assert.ok(!Util.isArray(new Function()));
  });

  it('Util.isString()', function ()
  {
    // positive tests
    assert.ok(Util.isString(''));
    assert.ok(Util.isString('foo'));
    assert.ok(Util.isString(String()));

    // negative tests
    assert.ok(!Util.isString(null));
    assert.ok(!Util.isString(undefined));
    assert.ok(!Util.isString(0));
    assert.ok(!Util.isString(1));
    assert.ok(!Util.isString(new Date()));
    assert.ok(!Util.isString({}));
    assert.ok(!Util.isString(new Object()));
    assert.ok(!Util.isString(function ()
    {
    }));
    assert.ok(!Util.isString(new Function()));
  });

  it('Util.isBoolean()', function ()
  {
    // positive tests
    assert.ok(Util.isBoolean(true));
    assert.ok(Util.isBoolean(false));

    // negative tests
    assert.ok(!Util.isBoolean(null));
    assert.ok(!Util.isBoolean(undefined));
    assert.ok(!Util.isBoolean(0));
    assert.ok(!Util.isBoolean(1));
    assert.ok(!Util.isBoolean('true'));
    assert.ok(!Util.isBoolean('false'));
    assert.ok(!Util.isBoolean(new Date()));
    assert.ok(!Util.isBoolean({}));
    assert.ok(!Util.isBoolean(new Object()));
    assert.ok(!Util.isBoolean(function ()
    {
    }));
    assert.ok(!Util.isBoolean(new Function()));
  });

  it('Util.isNumber()', function ()
  {
    // positive tests
    assert.ok(Util.isNumber(Number()));
    assert.ok(Util.isNumber(0));
    assert.ok(Util.isNumber(-1));
    assert.ok(Util.isNumber(Number.MAX_VALUE));
    assert.ok(Util.isNumber(Number.MIN_VALUE));
    assert.ok(Util.isNumber(Number.MAX_SAFE_INTEGER));
    assert.ok(Util.isNumber(Number.MIN_SAFE_INTEGER));

    // negative tests
    assert.ok(!Util.isNumber(Number.POSITIVE_INFINITY));
    assert.ok(!Util.isNumber(Number.NEGATIVE_INFINITY));
    assert.ok(!Util.isNumber(Number.NaN));
    assert.ok(!Util.isNumber(null));
    assert.ok(!Util.isNumber(undefined));
    assert.ok(!Util.isNumber(new Date()));
    assert.ok(!Util.isNumber({}));
    assert.ok(!Util.isNumber(new Object()));
    assert.ok(!Util.isNumber(function ()
    {
    }));
    assert.ok(!Util.isNumber(new Function()));
  });

  it('Util.exists()', function ()
  {
    // positive tests
    assert.ok(Util.exists(0));
    assert.ok(Util.exists(''));
    assert.ok(Util.exists([]));
    assert.ok(Util.exists(new Date()));
    assert.ok(Util.exists({}));
    assert.ok(Util.exists(new Object()));
    assert.ok(Util.exists(function ()
    {
    }));
    assert.ok(Util.exists(new Function()));

    // negative tests
    assert.ok(!Util.exists(null));
    assert.ok(!Util.exists(undefined));
  });

  it('Util.string.isNotNullOrEmpty()', function ()
  {
    // positive tests
    assert.ok(Util.string.isNotNullOrEmpty('foo'));

    // negative tests
    assert.ok(!Util.string.isNotNullOrEmpty(null));
    assert.ok(!Util.string.isNotNullOrEmpty(undefined));
    assert.ok(!Util.string.isNotNullOrEmpty(''));
    assert.ok(!Util.string.isNotNullOrEmpty(0));
    assert.ok(!Util.string.isNotNullOrEmpty([]));
    assert.ok(!Util.string.isNotNullOrEmpty(new Date()));
    assert.ok(!Util.string.isNotNullOrEmpty({}));
    assert.ok(!Util.string.isNotNullOrEmpty(new Object()));
  });

  it('Util.string.compareVersions()', function ()
  {
    var testCases = [];

    // '' and '0' are the same
    testCases.push(
      {
        version1: '',
        version2: '',
        result: 0
      },
      {
        version1: '',
        version2: '0',
        result: 0
      },
      {
        version1: '0',
        version2: '',
        result: 0
      });

    testCases.push(
      {
        version1: '0.0.1',
        version2: '0.1.0',
        result: -1
      },
      {
        version1: '0.0.1',
        version2: '0.1',
        result: -1
      },
      {
        version1: '0.1.0',
        version2: '0.0.1',
        result: 1
      },
      {
        version1: '1.1.0',
        version2: '0.1.1',
        result: 1
      },
      {
        version1: '1.1.0',
        version2: '0.1.1',
        result: 1
      },
      {
        version1: '0.1',
        version2: '0.1.0',
        result: 0
      },
      {
        version1: '5.10.0',
        version2: '6.0.0',
        result: -1
      });

    // if one or both inputs are invalid versions, return NaN
    testCases.push(
      {
        version1: '',
        version2: 0,
        result: NaN
      },
      {
        version1: 0,
        version2: '',
        result: NaN
      },
      {
        version1: 1,
        version2: 1,
        result: NaN
      },
      {
        version1: 1,
        version2: 2,
        result: NaN
      },
      {
        version1: {},
        version2: false,
        result: NaN
      },
      {
        version1: 'foo',
        version2: '1',
        result: NaN
      },
      {
        version1: '1',
        version2: 'foo',
        result: NaN
      },
      {
        version1: 'foo',
        version2: 'foo',
        result: NaN
      });

    var testCase, actual, expected;
    for (var index = 0, length = testCases.length; index < length; index++)
    {
      testCase = testCases[index];
      actual =
        Util.string.compareVersions(testCase.version1, testCase.version2);
      expected = testCase.result;

      assert.ok(isNaN(actual) && isNaN(expected) ? true : (actual === expected),
        'index = ' + index +
        ', version1 = ' + testCase.version1 +
        ', version2 = ' + testCase.version2);
    }
  });

  it('Util.number.isPositive()', function ()
  {
    // positive tests
    assert.ok(Util.number.isPositive(1));
    assert.ok(Util.number.isPositive(1.1));
    assert.ok(Util.number.isPositive(100));
    assert.ok(Util.number.isPositive(Number.MIN_VALUE));
    assert.ok(Util.number.isPositive(Number.MAX_SAFE_INTEGER));
    assert.ok(Util.number.isPositive(Number.MAX_VALUE));

    // negative tests
    assert.ok(!Util.number.isPositive(0));
    assert.ok(!Util.number.isPositive(-1));
    assert.ok(!Util.number.isPositive(-1.1));
    assert.ok(!Util.number.isPositive(Number.MIN_SAFE_INTEGER));
    assert.ok(!Util.number.isPositive(Number.POSITIVE_INFINITY));
    assert.ok(!Util.number.isPositive(Number.NEGATIVE_INFINITY));
  });

  it('Util.number.isNonNegative()', function ()
  {
    // positive tests
    assert.ok(Util.number.isNonNegative(0));
    assert.ok(Util.number.isNonNegative(1));
    assert.ok(Util.number.isNonNegative(1.1));
    assert.ok(Util.number.isNonNegative(100));
    assert.ok(Util.number.isNonNegative(Number.MIN_VALUE));
    assert.ok(Util.number.isNonNegative(Number.MAX_SAFE_INTEGER));
    assert.ok(Util.number.isNonNegative(Number.MAX_VALUE));

    // negative tests
    assert.ok(!Util.number.isNonNegative(-1));
    assert.ok(!Util.number.isNonNegative(-1.1));
    assert.ok(!Util.number.isNonNegative(Number.MIN_SAFE_INTEGER));
    assert.ok(!Util.number.isNonNegative(Number.POSITIVE_INFINITY));
    assert.ok(!Util.number.isNonNegative(Number.NEGATIVE_INFINITY));
  });

  it('Util.number.isInteger()', function ()
  {
    // positive tests
    assert.ok(Util.number.isInteger(0));
    assert.ok(Util.number.isInteger(1));
    assert.ok(Util.number.isInteger(-1));
    assert.ok(Util.number.isInteger(1.00));
    assert.ok(Util.number.isInteger(Number.MAX_SAFE_INTEGER));
    assert.ok(Util.number.isInteger(Number.MIN_SAFE_INTEGER));
    assert.ok(Util.number.isInteger(Number.MAX_VALUE));

    // negative tests
    assert.ok(!Util.number.isInteger(Number.MIN_VALUE));
    assert.ok(!Util.number.isInteger(1.1));
    assert.ok(!Util.number.isInteger(0.1));
    assert.ok(!Util.number.isInteger(-0.1));
    assert.ok(!Util.number.isInteger(Number.POSITIVE_INFINITY));
    assert.ok(!Util.number.isInteger(Number.NEGATIVE_INFINITY));
    assert.ok(!Util.number.isInteger(Number.NaN));
  });

  it('Util.number.isPositiveInteger()', function ()
  {
    // positive tests
    assert.ok(Util.number.isPositiveInteger(1));
    assert.ok(Util.number.isPositiveInteger(100));
    assert.ok(Util.number.isPositiveInteger(Number.MAX_SAFE_INTEGER));
    assert.ok(Util.number.isPositiveInteger(Number.MAX_VALUE));

    // negative tests
    assert.ok(!Util.number.isPositiveInteger(Number.MIN_VALUE));
    assert.ok(!Util.number.isPositiveInteger(0));
    assert.ok(!Util.number.isPositiveInteger(1.1));
    assert.ok(!Util.number.isPositiveInteger(-1.1));
    assert.ok(!Util.number.isPositiveInteger(Number.MIN_SAFE_INTEGER));
    assert.ok(!Util.number.isPositiveInteger(Number.POSITIVE_INFINITY));
    assert.ok(!Util.number.isPositiveInteger(Number.NEGATIVE_INFINITY));
  });

  it('Util.number.isNonNegativeInteger()', function ()
  {
    // positive tests
    assert.ok(Util.number.isNonNegativeInteger(0));
    assert.ok(Util.number.isNonNegativeInteger(1));
    assert.ok(Util.number.isNonNegativeInteger(100));
    assert.ok(Util.number.isNonNegativeInteger(Number.MAX_SAFE_INTEGER));
    assert.ok(Util.number.isNonNegativeInteger(Number.MAX_VALUE));

    // negative tests
    assert.ok(!Util.number.isNonNegativeInteger(Number.MIN_VALUE));
    assert.ok(!Util.number.isNonNegativeInteger(1.1));
    assert.ok(!Util.number.isNonNegativeInteger(-1.1));
    assert.ok(!Util.number.isNonNegativeInteger(Number.MIN_SAFE_INTEGER));
    assert.ok(!Util.number.isNonNegativeInteger(Number.POSITIVE_INFINITY));
    assert.ok(!Util.number.isNonNegativeInteger(Number.NEGATIVE_INFINITY));
  });

  it('Util.url.appendParam()', function ()
  {
    /////////////////////////////////////////////////////////////////////////
    ////                 Positive Test Cases                             ////
    /////////////////////////////////////////////////////////////////////////

    var testCasesPos =
      [
        {
          url: 'a',
          paramName: 'foo',
          paramValue: 'bar',
          result: 'a?foo=bar'
        },
        {
          url: 'http://www.something.snowflakecomputing.com',
          paramName: 'foo',
          paramValue: 'bar',
          result: 'http://www.something.snowflakecomputing.com?foo=bar'
        },
        {
          url: 'http://www.something.snowflakecomputing.com?param1=value1',
          paramName: 'foo',
          paramValue: 'bar',
          result: 'http://www.something.snowflakecomputing.com?param1=value1&foo=bar'
        }
      ];

    var testCase;
    for (var index = 0, length = testCasesPos.length; index < length; index++)
    {
      testCase = testCasesPos[index];
      assert.strictEqual(
        Util.url.appendParam(
          testCase.url, testCase.paramName, testCase.paramValue),
        testCase.result);
    }

    /////////////////////////////////////////////////////////////////////////
    ////                 Negative Test Cases                             ////
    /////////////////////////////////////////////////////////////////////////

    var testCasesNeg =
      [
        {
          paramName: 'foo',
          paramValue: 'bar'
        },
        {
          url: undefined,
          paramName: 'foo',
          paramValue: 'bar'
        },
        {
          url: null,
          paramName: 'foo',
          paramValue: 'bar'
        }
      ];

    var error;
    for (index = 0, length = testCasesPos.length; index < length; index++)
    {
      error = null;

      testCase = testCasesNeg[index];
      try
      {
        Util.url.appendParam(
          testCase.url, testCase.paramName, testCase.paramValue);
      }
      catch (err)
      {
        error = err;
      }
      finally
      {
        assert.ok(error);
      }
    }
  });

  describe('Append retry parameters', function () {
    const testCases =
      [
        {
          testName: "test appending retry params with retry reason",
          option: {
            url: 'http://www.something.snowflakecomputing.com',
            retryCount: 3,
            retryReason: 429,
            includeRetryReason: true,
          },
          result: 'http://www.something.snowflakecomputing.com?retryCount=3&retryReason=429'
        },
        {
          testName: "test appending retry params without retry reason",
          option: {
            url: 'http://www.something.snowflakecomputing.com',
            retryCount: 3,
            retryReason: 429,
            includeRetryReason: false,
          },
          result: 'http://www.something.snowflakecomputing.com?retryCount=3'
        }
      ];

      for (let i = 0; i < testCases.length; i++) {
        const testCase = testCases[i];
        it(testCase.testName, function () {
          const url = Util.url.appendRetryParam(testCase.option);
          assert.strictEqual(url, testCase.result);
        })
      }
  })

  it('Util.apply()', function ()
  {
    assert.strictEqual(Util.apply(null, null), null);
    assert.strictEqual(Util.apply(null, undefined), null);
    assert.strictEqual(Util.apply(null, {}), null);
    assert.strictEqual(Util.apply(undefined, null), undefined);
    assert.strictEqual(Util.apply(undefined, undefined), undefined);
    assert.strictEqual(Util.apply(undefined, {}), undefined);

    var dst, src;

    dst = {};
    src = null;
    assert.strictEqual(Util.apply(dst, src), dst);

    dst = {a: 1};
    src = {b: 2};
    assert.strictEqual(Util.apply(dst, src), dst);
    assert.strictEqual(Object.keys(dst).length, 2);
    assert.ok(dst.hasOwnProperty('a') && (dst.a === 1));
    assert.ok(dst.hasOwnProperty('b') && (dst.b === 2));

    dst = {a: 1};
    src = {a: 2};
    assert.strictEqual(Util.apply(dst, src), dst);
    assert.strictEqual(Object.keys(dst).length, 1);
    assert.ok(dst.hasOwnProperty('a') && (dst.a === 2));
  });

  it('Util.isRetryableHttpError()', function ()
  {
    var testCasesPos =
      [
        {
          name: '200 - OK',
          statusCode: 200,
          retry403: false,
          isRetryable: false,
        },
        {
          name: '400 - Bad Request',
          statusCode: 400,
          retry403: false,
          isRetryable: false,
        },
        {
          name: '403 - Forbidden',
          statusCode: 403,
          retry403: false,
          isRetryable: false,
        },
        {
          name: '403 - Forbidden (retry on 403)',
          statusCode: 403,
          retry403: true,
          isRetryable: true,
        },
        {
          name: '404 - Not Found',
          statusCode: 404,
          retry403: false,
          isRetryable: false,
        },
        {
          name: '408 - Request Timeout',
          statusCode: 408,
          retry403: false,
          isRetryable: true,
        },
        {
          name: '429 - Too Many Requests',
          statusCode: 429,
          retry403: false,
          isRetryable: true,
        },
        {
          name: '500 - Internal Server Error',
          statusCode: 500,
          retry403: false,
          isRetryable: true,
        },
        {
          name: '503 - Service Unavailable',
          statusCode: 503,
          retry403: false,
          isRetryable: true,
        },
      ];

    var testCase;
    var err;
    for (var index = 0, length = testCasesPos.length; index < length; index++)
    {
      testCase = testCasesPos[index];
      err = {
        response: { statusCode: testCase.statusCode }
      };
      assert.strictEqual(Util.isRetryableHttpError(
        err.response, testCase.retry403), testCase.isRetryable)
    }
  });

  describe('isPrivateKey', () => {
    [
      // pragma: allowlist nextline secret
      { name: 'trimmed already key', key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----' },
      {
        name: 'key with whitespaces at the beginning',
        // pragma: allowlist nextline secret
        key: '   -----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----'
      },
      {
        name: 'key with whitespaces at the end',
        // pragma: allowlist nextline secret
        key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----\n\n\n'
      },
    ].forEach(({ name, key }) => {
      it(`${name} is valid`, () => {
        assert.ok(Util.isPrivateKey(key));
      });
    });

    [
      { name: 'key without beginning and end', key: 'test' },
      { name: 'key with missing beginning', key: 'test\n-----END PRIVATE KEY-----' },
      {
        name: 'key with missing ending',
        // pragma: allowlist nextline secret
        key: '   -----BEGIN PRIVATE KEY-----\ntest'
      },
      {
        name: 'key with invalid beginning',
        key: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PRIVATE KEY-----\n\n\n'
      },
      {
        name: 'key with invalid end',
        // pragma: allowlist nextline secret
        key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PUBLIC KEY-----\n\n\n'
      },
    ].forEach(({ name, key }) => {
      it(`${name} is invalid`, () => {
        assert.ok(!Util.isPrivateKey(key));
      });
    });
  });
});
