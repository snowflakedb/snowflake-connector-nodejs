const async = require('async');
const snowflake = require('./../../lib/snowflake');
const testUtil = require('./testUtil');
const sharedStatement = require('./sharedStatements');
const assert = require('assert');

function normalize(source) {
  let result = {};
  if (typeof source === 'object' && source !== null) {
    Object.keys(source).forEach((key) => {
      if (typeof source[key] === 'object' && source[key] !== null) {
        source[key] = testUtil.normalizeRowObject(source[key]);
        result[key] = normalize(source[key]);
      } else {
        result = source;
      }
    });
  } else {
    result = source;
  }
  return result;
}


describe('Test Structured types', function () {
  let connection;

  before(function (done) {
    connection = testUtil.createConnection();
    async.series([
      function (callback) {
        // snowflake.configure({ 'disableOCSPChecks': true });
        // GlobalConfig.setDisableOCSPChecks(true);
        testUtil.connect(connection, callback);
      },
      function (callback) {
        testUtil.executeCmd(connection, 'alter session set ENABLE_STRUCTURED_TYPES_IN_CLIENT_RESPONSE = true', callback);
      },
      function (callback) {
        testUtil.executeCmd(connection, 'alter session set IGNORE_CLIENT_VESRION_IN_STRUCTURED_TYPES_RESPONSE = true', callback);
      },
      function (callback) {
        testUtil.executeCmd(connection, sharedStatement.setTimezoneAndTimestamps, callback);
      }],
    done
    );
  });

  describe('test object', function () {
    it('test simple object', function (done) {
      const selectObject = 'select {\'string\':\'a\'}::OBJECT(string VARCHAR) as result';

      async.series([
        function (callback) {
          testUtil.executeQueryAndVerify(
            connection,
            selectObject,
            [{ RESULT: { 'string': 'a' } }],
            callback
          );
        }],
      done
      );
    });

    it('test timestamp ltz', function (done) {
      const selectObject = 'select {' +
        '\'timestampltz\': \'2021-12-22 09:43:44\'::TIMESTAMP_LTZ' +
        '}' +
        '::OBJECT(timestampltz TIMESTAMP_LTZ) As RESULT';
      const expected = { timestampltz: '2021-12-22 09:43:44.000 -0800' };
      async.series([
        function (callback) {
          connection.execute({
            sqlText: selectObject,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const row = rows[0];
              const normalizedRow = {};
              Object.keys(row).forEach((key) => {
                normalizedRow[key] = testUtil.normalizeRowObject(row[key]);
              });
              assert.deepStrictEqual(normalizedRow.RESULT, expected);
              callback();
            }
          });
        }
      ],
      done
      );
    });

    it('test timestamp ltz fetch as string', function (done) {
      const selectObject = 'select {' +
        '\'timestampltz\': \'2021-12-22 09:43:44\'::TIMESTAMP_LTZ' +
        '}' +
        '::OBJECT(timestampltz TIMESTAMP_LTZ) As RESULT';
      const expected = '{"timestampltz":"2021-12-22 09:43:44.000 -0800"}';

      async.series([
        function (callback) {
          connection.execute({
            sqlText: selectObject,
            fetchAsString: [snowflake.OBJECT],
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const row = rows[0];
              const normalizedRow = {};
              Object.keys(row).forEach((key) => {
                normalizedRow[key] = testUtil.normalizeRowObject(row[key]);
              });
              assert.deepStrictEqual(row.RESULT, expected);
              callback();
            }
          });
        },
      ],
      done
      );
    });

    it('test timestamp ntz', function (done) {
      const selectObject = 'select {' +
        '\'timestampntz\': \'2021-12-22 09:43:44\'::TIMESTAMP_NTZ' +
        '}' +
        '::OBJECT(timestampntz TIMESTAMP_NTZ) AS RESULT';
      const expected = { timestampntz: '2021-12-22 09:43:44.000' };

      async.series([
        function (callback) {
          connection.execute({
            sqlText: selectObject,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const row = rows[0];
              const normalizedRow = {};
              Object.keys(row).forEach((key) => {
                normalizedRow[key] = testUtil.normalizeRowObject(row[key]);
              });
              assert.deepStrictEqual(normalizedRow.RESULT, expected);
              callback();
            }
          });
        },
      ],
      done
      );

    });

    it('test timestamp tz', function (done) {
      const selectObject = 'select {' +
        '\'timestamptz\': \'2021-12-24 09:45:45 -0800\'::TIMESTAMP_TZ' +
        '}' +
        '::OBJECT(timestamptz TIMESTAMP_TZ) AS RESULT';
      const expected = { timestamptz: '2021-12-24 09:45:45.000 -0800' };

      async.series([
        function (callback) {
          testUtil.executeCmd(connection, sharedStatement.setTimezoneAndTimestamps, callback);
        },
        function (callback) {
          connection.execute({
            sqlText: selectObject,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const row = rows[0];
              const normalizedRow = {};
              Object.keys(row).forEach((key) => {
                normalizedRow[key] = testUtil.normalizeRowObject(row[key]);
              });
              assert.deepStrictEqual(normalizedRow.RESULT, expected);
              callback();
            }
          });
        },
      ],
      done
      );

    });

    it('test date', function (done) {
      const selectObject = 'select {' +
        '\'date\': to_date(\'2023-12-24\')::DATE' +
        '}' +
        '::OBJECT(date DATE) AS RESULT';
      const expected = { date: '2023-12-24' };

      async.series([
        function (callback) {
          testUtil.executeCmd(connection, sharedStatement.setTimezoneAndTimestamps, callback);
        },
        function (callback) {
          connection.execute({
            sqlText: selectObject,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const row = rows[0];
              const normalizedRow = {};
              Object.keys(row).forEach((key) => {
                normalizedRow[key] = testUtil.normalizeRowObject(row[key]);
              });
              assert.deepStrictEqual(normalizedRow.RESULT, expected);
              callback();
            }
          });
        },
      ],
      done
      );

    });

    it('test time', function (done) {
      const selectObject = 'select {' +
        '\'time\': \'09:45:45\'::TIME' +
        '}' +
        '::OBJECT(time TIME) AS RESULT';
      const expected = { time: '09:45:45' };

      async.series([
        function (callback) {
          testUtil.executeCmd(connection, sharedStatement.setTimezoneAndTimestamps, callback);
        },
        function (callback) {
          connection.execute({
            sqlText: selectObject,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const row = rows[0];
              const normalizedRow = {};
              Object.keys(row).forEach((key) => {
                normalizedRow[key] = testUtil.normalizeRowObject(row[key]);
              });
              assert.deepStrictEqual(normalizedRow.RESULT, expected);
              callback();
            }
          });
        },
      ],
      done
      );

    });

    it('test binary', function (done) {
      const selectObject = 'select {' +
        '\'binary\': TO_BINARY(\'616263\', \'HEX\')' +
        '}' +
        '::OBJECT(binary BINARY) As RESULT';

      const expected = { RESULT: { 'binary': [97, 98, 99] } };

      async.series([
        function (callback) {
          connection.execute({
            sqlText: selectObject,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const row = rows[0];
              const normalizedRow = {};
              Object.keys(row).forEach((key) => {
                normalizedRow[key] = testUtil.normalizeRowObject(row[key]);
              });
              assert.deepStrictEqual(normalizedRow, expected);
              callback();
            }
          });
        }],
      done
      );
    });

    it('test object all types', function (done) {
      const selectObject = 'select {\'string\': \'a\'' +
        ', \'b\': 1, ' +
        '\'s\': 2, ' +
        '\'i\': 3, ' +
        '\'l\': 4,' +
        ' \'f\': 1.1,' +
        ' \'d\': 2.2,' +
        '\'bool\': true, ' +
        '\'timestampltz\': \'2021-12-22 09:43:44\'::TIMESTAMP_LTZ,' +
        ' \'timestampntz\': \'2021-12-23 09:44:44\'::TIMESTAMP_NTZ, ' +
        '\'timestamptz\': \'2021-12-24 09:45:45 -0800\'::TIMESTAMP_TZ,' +
        ' \'date\': \'2023-12-24\'::DATE, ' +
        '\'time\': \'12:34:56\'::TIME, ' +
        '\'binary\': TO_BINARY(\'616263\', \'HEX\') ' +
        '}' +
        '::OBJECT(string VARCHAR' +
        ', b TINYINT, ' +
        's SMALLINT, ' +
        'i INTEGER, ' +
        'l BIGINT, ' +
        'f FLOAT, ' +
        'd DOUBLE, ' +
        'bool BOOLEAN,' +
        'timestampltz TIMESTAMP_LTZ,' +
        'timestampntz TIMESTAMP_NTZ, ' +
        'timestamptz TIMESTAMP_TZ, ' +
        'date DATE, time TIME, ' +
        'binary BINARY' +
        ') AS RESULT';

      const expected = {
        RESULT: {
          string: 'a',
          b: 1,
          s: 2,
          i: 3,
          l: 4,
          f: 1.1,
          d: 2.2,
          bool: true,
          timestampltz: '2021-12-22 09:43:44.000 -0800',
          timestampntz: '2021-12-23 09:44:44.000',
          timestamptz: '2021-12-24 09:45:45.000 -0800',
          date: '2023-12-24',
          time: '12:34:56',
          binary: [97, 98, 99]
        }
      };

      async.series([
        function (callback) {
          testUtil.executeCmd(connection, sharedStatement.setTimezoneAndTimestamps, callback);
        },
        function (callback) {
          connection.execute({
            sqlText: selectObject,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const row = rows[0];
              const normalizedRow = {};
              Object.keys(row).forEach((key) => {
                normalizedRow[key] = testUtil.normalizeRowObject(row[key]);
              });
              assert.deepStrictEqual(normalizedRow, expected);
              callback();
            }
          });
        },
      ],
      done
      );
    });

    it('test object all types fetch as string', function (done) {
      const selectObject = 'select {\'string\': \'a\'' +
        ', \'b\': 1, ' +
        '\'s\': 2, ' +
        '\'i\': 3, ' +
        '\'l\': 4,' +
        ' \'f\': 1.1,' +
        ' \'d\': 2.2,' +
        '\'bool\': true, ' +
        '\'timestampltz\': \'2021-12-22 09:43:44\'::TIMESTAMP_LTZ,' +
        ' \'timestampntz\': \'2021-12-23 09:44:44\'::TIMESTAMP_NTZ, ' +
        '\'timestamptz\': \'2021-12-24 09:45:45 -0800\'::TIMESTAMP_TZ,' +
        ' \'date\': \'2023-12-24\'::DATE, ' +
        '\'time\': \'12:34:56\'::TIME, ' +
        '\'binary\': TO_BINARY(\'616263\', \'HEX\') ' +
        '}' +
        '::OBJECT(string VARCHAR' +
        ', b TINYINT, ' +
        's SMALLINT, ' +
        'i INTEGER, ' +
        'l BIGINT, ' +
        'f FLOAT, ' +
        'd DOUBLE, ' +
        'bool BOOLEAN,' +
        'timestampltz TIMESTAMP_LTZ,' +
        'timestampntz TIMESTAMP_NTZ, ' +
        'timestamptz TIMESTAMP_TZ, ' +
        'date DATE, time TIME, ' +
        'binary BINARY' +
        ') AS RESULT';

      const expected = {
        'RESULT': '{"string":"a","b":1,"s":2,"i":3,"l":4,"f":1.1,"d":2.2,"bool":true,"timestampltz":"2021-12-22 09:43:44.000 -0800","timestampntz":"2021-12-23 09:44:44.000","timestamptz":"2021-12-24 09:45:45.000 -0800","date":"2023-12-24","time":"12:34:56","binary":[97,98,99]}'
      };

      async.series([
        function (callback) {
          testUtil.executeCmd(connection, sharedStatement.setTimezoneAndTimestamps, callback);
        },
        function (callback) {
          connection.execute({
            sqlText: selectObject,
            fetchAsString: [snowflake.OBJECT],
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const row = rows[0];
              assert.deepStrictEqual(row, expected);
              callback();
            }
          });
        },
      ],
      done
      );
    });

    it('test nested object', function (done) {
      const selectObject = 'select {\'inside\': {\'string\':\'a\', \'int\':\'2\', \'timestamp\': \'2021-12-22 09:43:44\'::TIMESTAMP_LTZ}}' +
        '::OBJECT(inside OBJECT(string VARCHAR, int INTEGER, timestamp TIMESTAMP_LTZ)) as result';
      const expected = { RESULT: { 'inside': { 'string': 'a', 'int': 2, 'timestamp': '2021-12-22 09:43:44.000 -0800' } } };
      async.series([
        function (callback) {
          testUtil.executeCmd(connection, sharedStatement.setTimezoneAndTimestamps, callback);
        },
        function (callback) {
          connection.execute({
            sqlText: selectObject,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const row = rows[0];
              const narmalizedRow = normalize(row);
              assert.deepStrictEqual(narmalizedRow, expected);
              callback();
            }
          });
        },
      ],
      done
      );
    });

    it('test nested object - deeper hierarchy', function (done) {
      const selectObject = 'select {\'inside\': {\'string2\':\'level2\', \'inside2\': {\'string3\':\'a\', \'int\':\'2\', \'timestamp\': \'2021-12-22 09:43:44\'::TIMESTAMP_LTZ}}}' +
        '::OBJECT(inside OBJECT(string2 VARCHAR, inside2 OBJECT(string3 VARCHAR, int INTEGER, timestamp TIMESTAMP_LTZ))) as result';
      const expected = {
        RESULT: {
          'inside': {
            'string2': 'level2',
            'inside2': { 'string3': 'a', 'int': 2, 'timestamp': '2021-12-22 09:43:44.000 -0800' }
          }
        }
      };
      async.series([
        function (callback) {
          testUtil.executeCmd(connection, sharedStatement.setTimezoneAndTimestamps, callback);
        },
        function (callback) {
          connection.execute({
            sqlText: selectObject,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const row = rows[0];
              const narmalizedRow = normalize(row);
              assert.deepStrictEqual(narmalizedRow, expected);
              callback();
            }
          });
        },
      ],
      done
      );
    });

    it('test object all types', function (done) {
      const selectObject = 'select {\'string\': \'a\'' +
        ', \'b\': 1, ' +
        '\'s\': 2, ' +
        '\'i\': 3, ' +
        '\'l\': 4,' +
        ' \'f\': 1.1,' +
        ' \'d\': 2.2,' +
        ' \'bd\': 3.3, ' +
        '\'bool\': true, ' +
        '\'timestampLtz\': \'2021-12-22 09:43:44\'::TIMESTAMP_LTZ,' +
        ' \'timestampNtz\': \'2021-12-23 09:44:44\'::TIMESTAMP_NTZ, ' +
        '\'timestampTz\': \'2021-12-24 09:45:45 -0800\'::TIMESTAMP_TZ,' +
        ' \'date\': \'2023-12-24\'::DATE, ' +
        '\'time\': \'12:34:56\'::TIME, ' +
        '\'binary\': TO_BINARY(\'616263\', \'HEX\') ' +
        '}' +
        '::OBJECT(string VARCHAR' +
        ', b TINYINT, ' +
        's SMALLINT, ' +
        'i INTEGER, ' +
        'l BIGINT, ' +
        'f FLOAT, ' +
        'd DOUBLE, ' +
        'bd DOUBLE, ' +
        'bool BOOLEAN,' +
        'timestampLtz TIMESTAMP_LTZ,' +
        'timestampNtz TIMESTAMP_NTZ, ' +
        'timestampTz TIMESTAMP_TZ, ' +
        'date DATE, time TIME, ' +
        'binary BINARY' +
        ') AS RESULT';

      const expected = {
        RESULT: {
          string: 'a',
          b: 1,
          s: 2,
          i: 3,
          l: 4,
          f: 1.1,
          d: 2.2,
          bd: 3.3,
          bool: true,
          timestampLtz: '2021-12-22 09:43:44.000 -0800',
          timestampNtz: '2021-12-23 09:44:44.000',
          timestampTz: '2021-12-24 09:45:45.000 -0800',
          date: '2023-12-24',
          time: '12:34:56',
          binary: [97, 98, 99]
        }
      };

      async.series([
        function (callback) {
          testUtil.executeCmd(connection, sharedStatement.setTimezoneAndTimestamps, callback);
        },
        function (callback) {
          connection.execute({
            sqlText: selectObject,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const row = rows[0];
              const narmalizedRow = {};
              Object.keys(row).forEach((key) => {
                narmalizedRow[key] = testUtil.normalizeRowObject(row[key]);
              });
              assert.deepStrictEqual(narmalizedRow, expected);
              callback();
            }
          });
        },
      ],
      done
      );
    });
  });

  describe('test array', function () {

    it('test array of varchar', function (done) {
      const selectObject = 'SELECT ARRAY_CONSTRUCT(\'one\', \'two\', \'three\')::ARRAY(VARCHAR) AS RESULT';

      async.series([
        function (callback) {
          testUtil.executeQueryAndVerify(
            connection,
            selectObject,
            [{ RESULT: ['one', 'two', 'three'] }],
            callback
          );
        }],
      done
      );
    });

    it('test array of integer', function (done) {
      const selectObject = 'SELECT ARRAY_CONSTRUCT(1, 2, 3)::ARRAY(INTEGER) AS RESULT';

      async.series([
        function (callback) {
          testUtil.executeQueryAndVerify(
            connection,
            selectObject,
            [{ RESULT: [1, 2, 3] }],
            callback
          );
        }],
      done
      );
    });

    it('test array of timestampLtz', function (done) {
      const selectObject = 'SELECT ARRAY_CONSTRUCT(\'2021-12-22 09:43:44.123456\', \'2021-12-22 09:43:45.123456\')::ARRAY(TIMESTAMP_LTZ) AS kaka';

      const expected = ['2021-12-22 09:43:44.000 -0800', '2021-12-22 09:43:45.000 -0800'];
      async.series([
        function (callback) {
          connection.execute({
            sqlText: selectObject,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const row = rows[0];
              const narmalizedArray = [];
              row.KAKA.forEach((value) => {
                narmalizedArray.push(testUtil.normalizeValue(value));
              });
              assert.deepStrictEqual(narmalizedArray, expected);
              callback();
            }
          });
        }
      ],
      done
      );
    });

    it('test array of timestampNtz', function (done) {
      const selectObject = 'SELECT ARRAY_CONSTRUCT(\'2021-12-22 09:43:44\', \'2021-12-22 09:43:45\')::ARRAY(TIMESTAMP_NTZ) AS result';

      const expected = ['2021-12-22 09:43:44.000', '2021-12-22 09:43:45.000'];
      async.series([
        function (callback) {
          connection.execute({
            sqlText: selectObject,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const row = rows[0];
              const narmalizedArray = [];
              row.RESULT.forEach((value) => {
                narmalizedArray.push(testUtil.normalizeValue(value));
              });
              assert.deepStrictEqual(narmalizedArray, expected);
              callback();
            }
          });
        }
      ],
      done
      );
    });

  });

  describe('test map', function () {

    it('test simple map of varchar', function (done) {
      const selectObject = 'SELECT {\'x\':\'one\', \'y\':\'two\'}::MAP(VARCHAR, VARCHAR) AS RESULT';

      async.series([
        function (callback) {
          const map = new Map([
            ['x', 'one'],
            ['y', 'two'],
          ]);
          testUtil.executeQueryAndVerify(
            connection,
            selectObject,
            [{ RESULT: map }],
            callback
          );
        }],
      done
      );
    });

    it('test map of integer', function (done) {
      const selectObject = 'SELECT {\'1\':\'1\', \'2\':\'2\'}::MAP(INTEGER, INTEGER) AS RESULT';

      async.series([
        function (callback) {
          const map = new Map([
            [1, 1],
            [2, 2],
          ]);
          testUtil.executeQueryAndVerify(
            connection,
            selectObject,
            [{ RESULT: map }],
            callback
          );
        }],
      done
      );
    });

    it('test map of timestampLtz', function (done) {
      const selectObject = 'SELECT { \'1\':\'2021-12-22 09:43:44.123456\', \'2\':\'2021-12-22 09:43:45.123456\'}::MAP(INTEGER, TIMESTAMP_LTZ) AS result';

      const expected = new Map;
      expected.set(1, '2021-12-22 09:43:44.000 -0800');
      expected.set(2, '2021-12-22 09:43:45.000 -0800');
      async.series([
        function (callback) {
          connection.execute({
            sqlText: selectObject,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const row = rows[0];
              const narmalizedMap = new Map;
              row['RESULT'].forEach((value, key) => {
                narmalizedMap.set(key, testUtil.normalizeValue(value));
              });
              assert.deepStrictEqual(narmalizedMap, expected);
              callback();
            }
          });
        }
      ],
      done
      );
    });

    it('test map of timestampNtz', function (done) {

      const selectObject = 'SELECT { \'1\':\'2021-12-22 09:43:44\', \'2\':\'2021-12-22 09:43:45\'}::MAP(INTEGER, TIMESTAMP_NTZ) AS result';

      const expected = new Map;
      expected.set(1, '2021-12-22 09:43:44.000');
      expected.set(2, '2021-12-22 09:43:45.000');
      async.series([
        function (callback) {
          connection.execute({
            sqlText: selectObject,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const row = rows[0];
              const narmalizedMap = new Map;
              row['RESULT'].forEach((value, key) => {
                narmalizedMap.set(key, testUtil.normalizeValue(value));
              });
              assert.deepStrictEqual(narmalizedMap, expected);
              callback();
            }
          });
        }
      ],
      done
      );
    });

  });

  describe('test nested structures', function () {

    it('test array of objects', function (done) {

      const selectObject = 'SELECT ARRAY_CONSTRUCT({\'string\':\'a\', \'int\':\'1\', \'timestamp\': \'2021-12-22 09:43:44\'::TIMESTAMP_LTZ},' +
         '{\'string\':\'b\', \'int\':\'2\', \'timestamp\': \'2021-12-22 09:43:44\'::TIMESTAMP_LTZ}) ' +
      ':: ARRAY(OBJECT(string VARCHAR, int INTEGER, timestamp TIMESTAMP_LTZ)) AS RESULT';

      const expected = [{ 'string': 'a', 'int': 1, 'timestamp': '2021-12-22 09:43:44.000 -0800' },
        { 'string': 'b', 'int': 2, 'timestamp': '2021-12-22 09:43:44.000 -0800' }];

      async.series([
        function (callback) {
          connection.execute({
            sqlText: selectObject,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const row = rows[0];
              const narmalizedArray = [];
              row.RESULT.forEach((value) => {
                narmalizedArray.push(testUtil.normalizeRowObject(value));
              });
              assert.deepStrictEqual(narmalizedArray, expected);
              callback();
            }
          });
        }
      ],
      done
      );
    });

    it('test array of arrays', function (done) {

      const selectObject = 'SELECT ARRAY_CONSTRUCT(ARRAY_CONSTRUCT(\'one\', \'two\', \'three\'), ' +
        'ARRAY_CONSTRUCT(\'one\', \'two\', \'three\')) ' +
      ':: ARRAY(ARRAY(VARCHAR)) AS RESULT';

      const expected = [['one', 'two', 'three'], ['one', 'two', 'three']];

      async.series([
        function (callback) {
          connection.execute({
            sqlText: selectObject,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const row = rows[0];
              assert.deepStrictEqual(row.RESULT, expected);
              callback();
            }
          });
        }
      ],
      done
      );
    });

    it('test array of maps', function (done) {

      const selectObject = 'SELECT ARRAY_CONSTRUCT({\'x\':\'one\', \'y\':\'two\'}, ' +
        '{\'x\':\'one\', \'y\':\'two\'}) ' +
      ':: ARRAY(MAP(VARCHAR, VARCHAR)) AS RESULT';

      const map = new Map([
        ['x', 'one'],
        ['y', 'two'],
      ]);
      const expected = [map, map];

      async.series([
        function (callback) {
          connection.execute({
            sqlText: selectObject,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const row = rows[0];
              assert.deepStrictEqual(row.RESULT, expected);
              callback();
            }
          });
        }
      ],
      done
      );
    });

    it('test map of objects', function (done) {

      const selectObject = 'SELECT {\'x\': {\'string\':\'a\', \'int\':\'1\', \'timestamp\': \'2021-12-22 09:43:44\'::TIMESTAMP_LTZ},' +
        ' \'y\': {\'string\':\'b\', \'int\':\'2\', \'timestamp\': \'2021-12-22 09:43:44\'::TIMESTAMP_LTZ}} ::MAP(VARCHAR, OBJECT(string VARCHAR, int INTEGER, timestamp TIMESTAMP_LTZ)) AS RESULT';

      const expected = new Map([
        ['x', { 'string': 'a', 'int': 1, 'timestamp': '2021-12-22 09:43:44.000 -0800' }],
        ['y', { 'string': 'b', 'int': 2, 'timestamp': '2021-12-22 09:43:44.000 -0800' }],
      ]);

      async.series([
        function (callback) {
          connection.execute({
            sqlText: selectObject,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const row = rows[0];
              const narmalizedMap = new Map;
              row['RESULT'].forEach((value, key) => {
                narmalizedMap.set(key, testUtil.normalizeRowObject(value));
              });
              assert.deepStrictEqual(narmalizedMap, expected);
              callback();
            }
          });
        }
      ],
      done
      );
    });

    it('test map of arrays', function (done) {

      const selectObject = 'SELECT {\'x\': ARRAY_CONSTRUCT(\'one\', \'two\', \'three\'), ' +
        ' \'y\': ARRAY_CONSTRUCT(\'one\', \'two\')} ::MAP(VARCHAR, ARRAY(VARCHAR)) AS RESULT';

      const expected = new Map([
        ['x', ['one', 'two', 'three']],
        ['y', ['one', 'two']],
      ]);

      async.series([
        function (callback) {
          connection.execute({
            sqlText: selectObject,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const row = rows[0];
              assert.deepStrictEqual(row['RESULT'], expected);
              callback();
            }
          });
        }
      ],
      done
      );
    });

    it('test map of maps', function (done) {

      const selectObject = 'SELECT {\'1\': {\'x\':\'one\', \'y\':\'two\'}, ' +
        ' \'2\': {\'x\':\'one\', \'y\':\'two\'}} ::MAP(INTEGER, MAP(VARCHAR, VARCHAR)) AS RESULT';

      const map = new Map([
        ['x', 'one'],
        ['y', 'two'],
      ]);
      const expected = new Map();
      expected.set(1, map);
      expected.set(2, map);

      async.series([
        function (callback) {
          connection.execute({
            sqlText: selectObject,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const row = rows[0];
              assert.deepStrictEqual(row['RESULT'], expected);
              callback();
            }
          });
        }
      ],
      done
      );
    });

  });
});
