/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const Util = require('./../../lib/util');
const assert = require('assert');
const path = require('path');
const fsPromises = require('fs/promises');
const os = require('os');

describe('Util', function () {
  it('Util.isFunction()', function () {
    // positive tests
    assert.ok(Util.isFunction(function () {
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

  it('Util.isObject()', function () {
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
    assert.ok(!Util.isObject(function () {
    }));
    assert.ok(!Util.isObject(new Function()));
  });

  it('Util.isDate()', function () {
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
    assert.ok(!Util.isDate(function () {
    }));
    assert.ok(!Util.isDate(new Function()));
  });

  it('isArray()', function () {
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
    assert.ok(!Util.isArray(function () {
    }));
    assert.ok(!Util.isArray(new Function()));
  });

  it('Util.isString()', function () {
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
    assert.ok(!Util.isString(function () {
    }));
    assert.ok(!Util.isString(new Function()));
  });

  it('Util.isBoolean()', function () {
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
    assert.ok(!Util.isBoolean(function () {
    }));
    assert.ok(!Util.isBoolean(new Function()));
  });

  it('Util.isNumber()', function () {
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
    assert.ok(!Util.isNumber(function () {
    }));
    assert.ok(!Util.isNumber(new Function()));
  });

  it('Util.exists()', function () {
    // positive tests
    assert.ok(Util.exists(0));
    assert.ok(Util.exists(''));
    assert.ok(Util.exists([]));
    assert.ok(Util.exists(new Date()));
    assert.ok(Util.exists({}));
    assert.ok(Util.exists(new Object()));
    assert.ok(Util.exists(function () {
    }));
    assert.ok(Util.exists(new Function()));

    // negative tests
    assert.ok(!Util.exists(null));
    assert.ok(!Util.exists(undefined));
  });

  it('Util.string.isNotNullOrEmpty()', function () {
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

  it('Util.string.compareVersions()', function () {
    const testCases = [];

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

    let testCase, actual, expected;
    for (let index = 0, length = testCases.length; index < length; index++) {
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

  it('Util.number.isPositive()', function () {
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

  it('Util.number.isNonNegative()', function () {
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

  it('Util.number.isInteger()', function () {
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

  it('Util.number.isPositiveInteger()', function () {
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

  it('Util.number.isNonNegativeInteger()', function () {
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

  it('Util.url.appendParam()', function () {
    /////////////////////////////////////////////////////////////////////////
    ////                 Positive Test Cases                             ////
    /////////////////////////////////////////////////////////////////////////

    const testCasesPos =
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

    let testCase;
    for (let index = 0, length = testCasesPos.length; index < length; index++) {
      testCase = testCasesPos[index];
      assert.strictEqual(
        Util.url.appendParam(
          testCase.url, testCase.paramName, testCase.paramValue),
        testCase.result);
    }

    /////////////////////////////////////////////////////////////////////////
    ////                 Negative Test Cases                             ////
    /////////////////////////////////////////////////////////////////////////

    const testCasesNeg =
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

    let error;
    for (let index = 0, length = testCasesPos.length; index < length; index++) {
      error = null;

      testCase = testCasesNeg[index];
      try {
        Util.url.appendParam(
          testCase.url, testCase.paramName, testCase.paramValue);
      } catch (err) {
        error = err;
      } finally {
        assert.ok(error);
      }
    }
  });

  describe('Append retry parameters', function () {
    const testCases =
      [
        {
          testName: 'test appending retry params with retry reason',
          option: {
            url: 'http://www.something.snowflakecomputing.com',
            retryCount: 3,
            retryReason: 429,
            includeRetryReason: true,
          },
          result: 'http://www.something.snowflakecomputing.com?retryCount=3&retryReason=429'
        },
        {
          testName: 'test appending retry params without retry reason',
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
      });
    }
  });

  describe('Util.isLoginRequest Test', function () {
    const baseUrl = 'wwww.test.com';
    const testCases =
    [
      {
        testName: 'test URL with a right login end point',
        endPoint: '/v1/login-request',
        result: true,
      },
      {
        testName: 'test URL with a wrong login end point',
        endPoint: '/login-request',
        result: false,
      },
      {
        testName: 'test URL with a right authenticator-request point',
        endPoint: '/authenticator-request',
        result: true,
      },
      {
        testName: 'test URL with a wrong authenticator-request point',
        endPoint: '/authenticator-requ',
        result: false,
      }
    ];

    for (const { testName, endPoint, result } of testCases) {
      it(testName, function () {
        const isLoginRequest = Util.isLoginRequest(baseUrl + endPoint);
        assert.strictEqual(isLoginRequest, result);
      });
    }
  });

  describe('Util.getJitterSleepTime Test', function () {
    it('test - retryTimeout is over 300', function () {
      const errorCodes =
      [
        {
          statusCode: 403,
          retry403: true,
          isRetryable: true,
        },
        {
          statusCode: 408,
          retry403: false,
          isRetryable: true,
        },
        {
          statusCode: 429,
          retry403: false,
          isRetryable: true,
        },
        {
          statusCode: 500,
          retry403: false,
          isRetryable: true,
        },
        {
          statusCode: 503,
          retry403: false,
          isRetryable: true,
        },
        {
          statusCode: 538,
          retry403: false,
          isRetryable: true,
        },
      ];

      const maxRetryTimeout = 300;
      let currentSleepTime = 1;
      let retryCount = 0;
      let totalElapsedTime = currentSleepTime;
      for (const response of errorCodes) {
        const result = Util.getJitteredSleepTime(retryCount, currentSleepTime, totalElapsedTime, maxRetryTimeout);
        const jitter = currentSleepTime / 2;
        const nextSleep = 2 ** retryCount;
        currentSleepTime = result.sleep;
        totalElapsedTime = result.totalElapsedTime;
        retryCount++;

        assert.strictEqual(Util.isRetryableHttpError(response, true), true);
        assert.ok(currentSleepTime <= nextSleep + jitter || currentSleepTime >= nextSleep - jitter);
      }

      assert.strictEqual(retryCount, 6);
      assert.ok(totalElapsedTime <= maxRetryTimeout);
    });

    it('test - retryTimeout is 0', function () {
      const maxRetryTimeout = 0;
      let currentSleepTime = 1;
      const maxRetryCount = 20;
      let totalElapsedTime = currentSleepTime;
      let retryCount = 1;
      for ( ; retryCount < maxRetryCount; retryCount++) {
        const result = Util.getJitteredSleepTime(retryCount, currentSleepTime, totalElapsedTime, maxRetryTimeout);
        const jitter = currentSleepTime / 2;
        const nextSleep = 2 ** retryCount;
        currentSleepTime = result.sleep;
        totalElapsedTime = result.totalElapsedTime;

        assert.ok(currentSleepTime <= nextSleep + jitter || currentSleepTime >= nextSleep - jitter);
      }

      assert.strictEqual(retryCount, 20);
    });
  });

  it('Util.chooseRandom Test', function () {
    const positiveInteger = Util.chooseRandom(1, 5);
    const negativeInteger = Util.chooseRandom(-1, -5);
    const randomNumber = Util.chooseRandom(positiveInteger, negativeInteger);
    const randomNumbers = [];

    assert.ok(1 <= positiveInteger && positiveInteger <= 5);
    assert.ok(-5 <= negativeInteger && negativeInteger <= -1);
    assert.ok(negativeInteger <= randomNumber && randomNumber <= positiveInteger);

    for (let i = 0; i < 10; i++) {
      randomNumbers.push(Util.chooseRandom(positiveInteger, negativeInteger));
    }

    for (let i = 0; i < 9; i++) {
      assert.ok(randomNumbers[i] !== randomNumbers[i + 1]);
    }
  });

  it('Util.getJitter Test', function () {
    const randomNumber = Util.chooseRandom(10, 100);
    const jitter = Util.getJitter(randomNumber);

    assert.ok(randomNumber / -2 <= jitter && jitter <= randomNumber / 2  );
  });

  it('Util.apply()', function () {
    assert.strictEqual(Util.apply(null, null), null);
    assert.strictEqual(Util.apply(null, undefined), null);
    assert.strictEqual(Util.apply(null, {}), null);
    assert.strictEqual(Util.apply(undefined, null), undefined);
    assert.strictEqual(Util.apply(undefined, undefined), undefined);
    assert.strictEqual(Util.apply(undefined, {}), undefined);

    let dst, src;

    dst = {};
    src = null;
    assert.strictEqual(Util.apply(dst, src), dst);

    dst = { a: 1 };
    src = { b: 2 };
    assert.strictEqual(Util.apply(dst, src), dst);
    assert.strictEqual(Object.keys(dst).length, 2);
    assert.ok(Object.prototype.hasOwnProperty.call(dst, 'a') && (dst.a === 1));
    assert.ok(Object.prototype.hasOwnProperty.call(dst, 'b') && (dst.b === 2));

    dst = { a: 1 };
    src = { a: 2 };
    assert.strictEqual(Util.apply(dst, src), dst);
    assert.strictEqual(Object.keys(dst).length, 1);
    assert.ok(Object.prototype.hasOwnProperty.call(dst, 'a') && (dst.a === 2));
  });

  it('Util.isRetryableHttpError()', function () {
    const testCasesPos =
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

    let testCase;
    let err;
    for (let index = 0, length = testCasesPos.length; index < length; index++) {
      testCase = testCasesPos[index];
      err = {
        response: { statusCode: testCase.statusCode }
      };
      assert.strictEqual(Util.isRetryableHttpError(
        err.response, testCase.retry403), testCase.isRetryable);
    }
  });

  describe('Okta Authentication Retry Condition', () => {
    const testCases =
    [
      {
        name: 'test - default values',
        retryOption: {
          maxRetryCount: 7,
          numRetries: 1,
          remainingTimeout: 300000,
          maxRetryTimeout: 300000
        },
        result: true,
      },
      {
        name: 'test - the value of the numRetries is the same as the max retry count',
        retryOption: {
          maxRetryCount: 7,
          numRetries: 7,
          remainingTimeout: 300000,
          maxRetryTimeout: 300000
        },
        result: true,
      },
      {
        name: 'test - max retry timeout is 0',
        retryOption: {
          maxRetryCount: 7,
          numRetries: 1,
          remainingTimeout: 300000,
          maxRetryTimeout: 0
        },
        result: true,
      },
      {
        name: 'test - the max retry timeout is 0 and number of retry is over',
        retryOption: {
          maxRetryCount: 7,
          numRetries: 8,
          remainingTimeout: -50,
          maxRetryTimeout: 0
        },
        result: false,
      },
      {
        name: 'test - the retry count is over the max retry count ',
        retryOption: {
          maxRetryCount: 7,
          numRetries: 8,
          remainingTimeout: 300000,
          maxRetryTimeout: 300
        },
        result: false,
      },
      {
        name: 'test - the remaining timeout is 0',
        retryOption: {
          maxRetryCount: 7,
          numRetries: 8,
          remainingTimeout: 0,
          maxRetryTimeout: 300
        },
        result: false,
      },
      {
        name: 'test - the remaining timeout is negative',
        retryOption: {
          maxRetryCount: 7,
          numRetries: 8,
          remainingTimeout: -10,
          maxRetryTimeout: 300
        },
        result: false,
      },
    ];

    testCases.forEach(({ name, retryOption, result }) => {
      it(name, () => {
        assert.strictEqual(Util.shouldRetryOktaAuth({ ...retryOption, startTime: Date.now() }), result);
      });
    });
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

  describe('isPrivateLink', () => {
    [
      {
        name: 'private link',
        host: 'account.privatelink.snowflakecomputing.com',
        result: true
      },
      {
        name: 'private link upper case letters',
        host: 'ACCOUNT.PRIVATELINK.SNOWFLAKECOMPUTING.COM',
        result: true
      },
      {
        name: 'private link mixed case letters',
        host: 'account.privateLINK.snowflakecomputING.com',
        result: true
      },
      {
        name: 'no private link',
        host: 'account.snowflakecomputing.com',
        result: false
      },
      {
        name: 'private link cn',
        host: 'account.privatelink.snowflakecomputing.cn',
        result: true
      },
      {
        name: 'no private link cn',
        host: 'account.snowflakecomputing.cn',
        result: false
      }
    ].forEach(({ name, host, result }) => {
      it(`${name} is valid`, () => {
        assert.equal(Util.isPrivateLink(host), result);
      });
    });
  });

  describe('Util Test - handling circular reference in isValidAsync exception handling', () => {
    const shouldMatchNonCircular = '{"one":1,"two":2}';
    const shouldMatchCircular = '{"one":1,"two":2,"myself":"[Circular]"}';

    it('non-circular reference is handled correctly by JSON.stringify replacer', () => {
      const a = { 'one': 1, 'two': 2 };
      const replacedA = JSON.stringify(a, Util.getCircularReplacer());
      assert.deepEqual(replacedA, shouldMatchNonCircular);
    });

    it('circular reference is handled correctly by JSON.stringify replacer', () => {
      const b = { 'one': 1, 'two': 2 };
      b.myself = b;
      const replacedB = JSON.stringify(b, Util.getCircularReplacer());
      assert.deepEqual(replacedB, shouldMatchCircular);
    });
  });

  describe('Util test - custom credential manager util functions', function () {
    const mockUser = 'mockUser';
    const mockHost = 'mockHost';
    const mockCred = 'mockCred';

    describe('test function build credential key', function () {
      const testCases = [
        {
          name: 'when all the parameters are null',
          user: null,
          host: null,
          cred: null,
          result: null
        },
        {
          name: 'when two parameters are null or undefined',
          user: mockUser,
          host: null,
          cred: undefined,
          result: null
        },
        {
          name: 'when one parameter is null',
          user: mockUser,
          host: mockHost,
          cred: undefined,
          result: null
        },
        {
          name: 'when one parameter is undefined',
          user: mockUser,
          host: undefined,
          cred: mockCred,
          result: null
        },
        {
          name: 'when all the parameters are valid',
          user: mockUser,
          host: mockHost,
          cred: mockCred,
          result: '{mockHost}:{mockUser}:{SF_NODE_JS_DRIVER}:{mockCred}}'
        },
      ];
      testCases.forEach((name, user, host, cred, result) => {
        it(`${name}`, function () {
          if (!result) {
            assert.strictEqual(Util.buildCredentialCacheKey(host, user, cred), null);
          } else {
            assert.strictEqual(Util.buildCredentialCacheKey(host, user, cred), result);
          }
        });
      });
    });
  });

  describe('test valid custom credential manager', function () {

    function sampleManager() {
      this.read = function () {};

      this.write = function () {};

      this.remove = function () {};
    }

    const testCases = [
      {
        name: 'credential manager is an int',
        credentialManager: 123,
        result: false,
      },
      {
        name: 'credential manager is a string',
        credentialManager: 'credential manager',
        result: false,
      },
      {
        name: 'credential manager is an array',
        credentialManager: ['write', 'read', 'remove'],
        result: false,
      },
      {
        name: 'credential manager is an empty object',
        credentialManager: {},
        result: false,
      },
      {
        name: 'credential manager has property, but invalid types',
        credentialManager: {
          read: 'read',
          write: 1234,
          remove: []
        },
        result: false,
      },
      {
        name: 'credential manager has property, but invalid types',
        credentialManager: {
          read: 'read',
          write: 1234,
          remove: []
        },
        result: false,
      },
      {
        name: 'credential manager has two valid properties, but miss one',
        credentialManager: {
          read: function () {

          },
          write: function () {

          }
        },
        result: false,
      },
      {
        name: 'credential manager has two valid properties, but miss one',
        credentialManager: new sampleManager(),
        result: true,
      },
    ];

    for (const { name, credentialManager, result } of testCases) {
      it(name, function () {
        assert.strictEqual(Util.checkValidCustomCredentialManager(credentialManager), result);
      });
    }
  });

  describe('checkParametersDefined function Test', function () {
    const testCases = [
      {
        name: 'all the parameters are null or undefined',
        parameters: [null, undefined, null, null],
        result: false
      },
      {
        name: 'one parameter is null',
        parameters: ['a', 2, true, null],
        result: false
      },
      {
        name: 'all the parameter are existing',
        parameters: ['a', 123, ['testing'], {}],
        result: true
      },
    ];
  
    for (const { name, parameters, result } of testCases) {
      it(name, function () {
        assert.strictEqual(Util.checkParametersDefined(...parameters), result);
      });
    }
  });

  if (os.platform() !== 'win32') {
    describe('Util.isFileNotWritableByGroupOrOthers()', function () {
      let tempDir = null;
      let oldMask = null;

      before(async function () {
        tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'permission_tests'));
        oldMask = process.umask(0o000);
      });

      after(async function () {
        await fsPromises.rm(tempDir, { recursive: true, force: true });
        process.umask(oldMask);
      });

      [
        { filePerm: 0o700, isValid: true },
        { filePerm: 0o600, isValid: true },
        { filePerm: 0o500, isValid: true },
        { filePerm: 0o400, isValid: true },
        { filePerm: 0o300, isValid: true },
        { filePerm: 0o200, isValid: true },
        { filePerm: 0o100, isValid: true },
        { filePerm: 0o707, isValid: false },
        { filePerm: 0o706, isValid: false },
        { filePerm: 0o705, isValid: true },
        { filePerm: 0o704, isValid: true },
        { filePerm: 0o703, isValid: false },
        { filePerm: 0o702, isValid: false },
        { filePerm: 0o701, isValid: true },
        { filePerm: 0o770, isValid: false },
        { filePerm: 0o760, isValid: false },
        { filePerm: 0o750, isValid: true },
        { filePerm: 0o740, isValid: true },
        { filePerm: 0o730, isValid: false },
        { filePerm: 0o720, isValid: false },
        { filePerm: 0o710, isValid: true },
      ].forEach(async function ({ filePerm, isValid }) {
        it('File with permission: ' + filePerm.toString(8) + ' should be valid=' + isValid, async function () {
          const filePath = path.join(tempDir, `file_${filePerm.toString()}`);
          await writeFile(filePath, filePerm);
          assert.strictEqual(await Util.isFileNotWritableByGroupOrOthers(filePath, fsPromises), isValid);
        });
      });

      async function writeFile(filePath, mode) {
        await fsPromises.writeFile(filePath, '', { encoding: 'utf8', mode: mode });
      }
    });
  }

  if (os.platform() !== 'win32') {
    describe('Util.isFileModeCorrect()', function () {
      const tempDir = path.join(os.tmpdir(), 'permission_tests');
      let oldMask = null;

      before(async function () {
        await fsPromises.mkdir(tempDir);
        oldMask = process.umask(0o000);
      });

      after(async function () {
        await fsPromises.rm(tempDir, { recursive: true, force: true });
        process.umask(oldMask);
      });

      [
        { dirPerm: 0o700, expectedPerm: 0o700, isCorrect: true },
        { dirPerm: 0o755, expectedPerm: 0o600, isCorrect: false },
      ].forEach(async function ({ dirPerm, expectedPerm, isCorrect }) {
        it('Should return ' + isCorrect + ' when directory permission ' + dirPerm.toString(8) + ' is compared to ' + expectedPerm.toString(8), async function () {
          const dirPath = path.join(tempDir, `dir_${dirPerm.toString(8)}`);
          await fsPromises.mkdir(dirPath, { mode: dirPerm });
          assert.strictEqual(await Util.isFileModeCorrect(dirPath, expectedPerm, fsPromises), isCorrect);
        });
      });

      [
        { filePerm: 0o700, expectedPerm: 0o700, isCorrect: true },
        { filePerm: 0o755, expectedPerm: 0o600, isCorrect: false },
      ].forEach(async function ({ filePerm, expectedPerm, isCorrect }) {
        it('Should return ' + isCorrect + ' when file permission ' + filePerm.toString(8) + ' is compared to ' + expectedPerm.toString(8), async function () {
          const dirPath = path.join(tempDir, `file_${filePerm.toString(8)}`);
          await fsPromises.appendFile(dirPath, '', { mode: filePerm });
          assert.strictEqual(await Util.isFileModeCorrect(dirPath, expectedPerm, fsPromises), isCorrect);
        });
      });
    });
  }

  describe('shouldPerformGCPBucket function test', () => {
    const testCases = [
      {
        name: 'test - default',
        accessToken: 'Token',
        forceGCPUseDownscopedCredential: false,
        result: true,
      },
      {
        name: 'test - when the disableGCPTokenUpload is enabled',
        accessToken: 'Token',
        forceGCPUseDownscopedCredential: true,
        result: false,
      },
      {
        name: 'test - when token is empty but the disableGCPTokenUpload is enabled',
        accessToken: null,
        forceGCPUseDownscopedCredential: true,
        result: false,
      },
      {
        name: 'test - when token is empty but the disableGCPTokenUpload is disabled',
        accessToken: null,
        forceGCPUseDownscopedCredential: false,
        result: false,
      },
    ];

    testCases.forEach(({ name, accessToken, forceGCPUseDownscopedCredential, result }) => {
      it(name, () => {
        process.env.SNOWFLAKE_FORCE_GCP_USE_DOWNSCOPED_CREDENTIAL = forceGCPUseDownscopedCredential;
        assert.strictEqual(Util.shouldPerformGCPBucket(accessToken), result);
        delete process.env.SNOWFLAKE_FORCE_GCP_USE_DOWNSCOPED_CREDENTIAL;
      });
    });
  });

  describe('getEnvVar function Test', function () {
    const testCases = [
      {
        name: 'snowflake_env_test',
        value: 'mock_value',
      },
      {
        name: 'SNOWFLAKE_ENV_TEST',
        value: 'MOCK_VALUE',
      },
    ];

    for (const { name, value, } of testCases) {
      it(name, function () {
        process.env[name] = value;
        assert.strictEqual(Util.getEnvVar('snowflake_env_test'), value);
        assert.strictEqual(Util.getEnvVar('SNOWFLAKE_ENV_TEST'), value);
        delete process.env[name];
      });
    }
  });

  describe('isEmptyObject function test', function () {
    const testCases = [
      {
        name: 'JSON is not empty',
        value: { 'hello': 'a' },
        result: false
      },
      {
        name: 'JSON is empty',
        value: {},
        result: true
      },
      {
        name: 'non object(string)',
        value: 'hello world',
        result: false,
      },
      {
        name: 'non object(int)',
        value: 123,
        result: false,
      },
      {
        name: 'non object(int)',
        value: 123,
        result: false,
      },
      {
        name: 'array',
        value: [1, 2, 3],
        result: false,
      },
      {
        name: 'empty array',
        value: [],
        result: true,
      },
      {
        name: 'null',
        value: null,
        result: true,
      }, {
        name: 'undefined',
        value: undefined,
        result: true,
      },
    ];

    testCases.forEach(({ name, value, result }) => {
      it(name, function () {        
        assert.strictEqual(Util.isEmptyObject(value), result);
      });
    });      

    describe('lstrip function Test', function () {
      const testCases = [
        {
          name: 'remove consecutive characters /',
          str: '///////////helloworld',
          remove: '/',
          result: 'helloworld'
        },
        {
          name: 'when the first character is not matched with the remove character',
          str: '/\\/\\helloworld',
          remove: '\\',
          result: '/\\/\\helloworld'
        },
        {
          name: 'when the first and the third characters are matched',
          str: '@1@12345helloworld',
          remove: '@',
          result: '1@12345helloworld'
        },
      ];

      for (const { name, str, remove,  result } of testCases) {
        it(name, function () {
          assert.strictEqual(Util.lstrip(str, remove), result);
        });
      }
    });

  });
});