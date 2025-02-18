const SfTimestamp = require('./../../../../lib/connection/result/sf_timestamp');
const assert = require('assert');

describe('Date: basic', function () {
  const testCases =
    [
      {
        name: 'date: YYYY-MM-DD',
        options:
          {
            epochSeconds: 1448496000,
            nanoSeconds: 0,
            scale: 0,
            timezone: 'UTC',
            format: 'YYYY-MM-DD'
          },
        result: '2015-11-26'
      },
      {
        name: 'date: YYYY',
        options:
          {
            epochSeconds: 1448496000,
            nanoSeconds: 0,
            scale: 0,
            timezone: 'UTC',
            format: 'YYYY'
          },
        result: '2015'
      },
      {
        name: 'date: MM',
        options:
          {
            epochSeconds: 1448496000,
            nanoSeconds: 0,
            scale: 0,
            timezone: 'UTC',
            format: 'MM'
          },
        result: '11'
      },
      {
        name: 'date: DD',
        options:
          {
            epochSeconds: 1448496000,
            nanoSeconds: 0,
            scale: 0,
            timezone: 'UTC',
            format: 'DD'
          },
        result: '26'
      }
    ];

  testCases.forEach(function (testCase) {
    it(testCase.name, function () {
      const options = testCase.options;
      assert.strictEqual(
        new SfTimestamp(
          options.epochSeconds,
          options.nanoSeconds,
          options.scale,
          options.timezone,
          options.format).toString(),
        testCase.result);
    });
  });
});

describe('Timestamp: basic', function () {
  const testCases =
    [
      {
        name: 'timestamp: DY, DD MON YYYY HH24:MI:SS TZHTZM',
        options:
          {
            epochSeconds: 1448570571,
            nanoSeconds: 906000000,
            scale: 9,
            timezone: 'America/Los_Angeles',
            format: 'DY, DD MON YYYY HH24:MI:SS TZHTZM'
          },
        result: 'Thu, 26 Nov 2015 12:42:51 -0800'
      },
      {
        name: 'timestamp: YYYY-MM-DD HH24:MI:SS.FF TZHTZM',
        options:
          {
            epochSeconds: 1448570571,
            nanoSeconds: 123456000,
            scale: 6,
            timezone: 'America/Los_Angeles',
            format: 'YYYY-MM-DD HH24:MI:SS.FF TZHTZM'
          },
        result: '2015-11-26 12:42:51.123456 -0800'
      },
      {
        name: 'timestamp: YYYY-MM-DD HH24:MI:SS.FF3 TZHTZM',
        options:
          {
            epochSeconds: 1448570571,
            nanoSeconds: 123456789,
            scale: 9,
            timezone: 'America/Los_Angeles',
            format: 'YYYY-MM-DD HH24:MI:SS.FF3 TZHTZM'
          },
        result: '2015-11-26 12:42:51.123 -0800'
      },
      {
        name: 'timestamp: YYYY-MM-DD HH24:MI:SS.FF9 TZHTZM',
        options:
          {
            epochSeconds: 1448570571,
            nanoSeconds: 123456789,
            scale: 9,
            timezone: 'America/Los_Angeles',
            format: 'YYYY-MM-DD HH24:MI:SS.FF9 TZHTZM'
          },
        result: '2015-11-26 12:42:51.123456789 -0800'
      }
    ];

  testCases.forEach(function (testCase) {
    it(testCase.name, function () {
      const options = testCase.options;
      assert.strictEqual(
        new SfTimestamp(
          options.epochSeconds,
          options.nanoSeconds,
          options.scale,
          options.timezone,
          options.format).toString(),
        testCase.result);
    });
  });
});

describe('Time: basic', function () {
  const testCases =
    [
      {
        name: 'time: HH24:MI:SS',
        options:
          {
            epochSeconds: 45296,
            nanoSeconds: 0,
            scale: 3,
            timezone: 'UTC',
            format: 'HH24:MI:SS'
          },
        result: '12:34:56'
      },
      {
        name: 'time: HH24:MI:SS.FF',
        options:
          {
            epochSeconds: 45296,
            nanoSeconds: 789000000,
            scale: 3,
            timezone: 'UTC',
            format: 'HH24:MI:SS.FF'
          },
        result: '12:34:56.789'
      },
      {
        name: 'time: HH24:MI:SS.FF3',
        options:
          {
            epochSeconds: 45296,
            nanoSeconds: 789789789,
            scale: 9,
            timezone: 'UTC',
            format: 'HH24:MI:SS.FF3'
          },
        result: '12:34:56.789'
      },
      {
        name: 'time: HH24:MI:SS.FF9',
        options:
          {
            epochSeconds: 45296,
            nanoSeconds: 789789789,
            scale: 9,
            timezone: 'UTC',
            format: 'HH24:MI:SS.FF9'
          },
        result: '12:34:56.789789789'
      }
    ];

  testCases.forEach(function (testCase) {
    it(testCase.name, function () {
      const options = testCase.options;
      assert.strictEqual(
        new SfTimestamp(
          options.epochSeconds,
          options.nanoSeconds,
          options.scale,
          options.timezone,
          options.format).toString(),
        testCase.result);
    });
  });
});
