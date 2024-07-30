/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const async = require('async');
const GlobalConfig = require('./../../lib/global_config');
const snowflake = require('./../../lib/snowflake');
const testUtil = require('./testUtil');
const sharedStatement = require('./sharedStatements');
const assert = require('assert');

describe('Test Structured types', function () {
  let connection;

  before(function (done) {
    connection = testUtil.createConnection({ 'proxyHost': '127.0.0.1', 'proxyPort': 8080 });
    async.series([
      function (callback) {
        snowflake.configure({ 'insecureConnect': true });
        GlobalConfig.setInsecureConnect(true);
        testUtil.connect(connection, callback);
      },
      function (callback) {
        testUtil.executeCmd(connection, 'alter session set ENABLE_STRUCTURED_TYPES_IN_CLIENT_RESPONSE = true', callback);
      },
      function (callback) {
        testUtil.executeCmd(connection, 'alter session set IGNORE_CLIENT_VESRION_IN_STRUCTURED_TYPES_RESPONSE = true', callback);
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
        '\'timestamp_ltz\': \'2021-12-22 09:43:44\'::TIMESTAMP_LTZ' +
        '}' +
        '::OBJECT(timestamp_ltz TIMESTAMP_LTZ) As RESULT';
      const expected = { timestamp_ltz: '2021-12-22 09:43:44.000 -0800' };
      async.series([
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
              assert.deepStrictEqual(narmalizedRow.RESULT, expected);
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
        '\'timestamp_ltz\': \'2021-12-22 09:43:44\'::TIMESTAMP_LTZ' +
        '}' +
        '::OBJECT(timestamp_ltz TIMESTAMP_LTZ) As RESULT';
      const expected = '{"timestamp_ltz":"2021-12-22 09:43:44.000 -0800"}';

      async.series([
        function (callback) {
          connection.execute({
            sqlText: selectObject,
            fetchAsString: [snowflake.OBJECT],
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const row = rows[0];
              const narmalizedRow = {};
              Object.keys(row).forEach((key) => {
                narmalizedRow[key] = testUtil.normalizeRowObject(row[key]);
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
        '\'timestamp_ntz\': \'2021-12-22 09:43:44\'::TIMESTAMP_NTZ' +
        '}' +
        '::OBJECT(timestamp_ntz TIMESTAMP_NTZ) AS RESULT';
      const expected = { timestamp_ntz: '2021-12-22 09:43:44.000' };

      async.series([
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
              assert.deepStrictEqual(narmalizedRow.RESULT, expected);
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
        '\'timestamp_tz\': \'2021-12-24 09:45:45 -0800\'::TIMESTAMP_TZ' +
        '}' +
        '::OBJECT(timestamp_tz TIMESTAMP_TZ) AS RESULT';
      const expected = { timestamp_tz: '2021-12-24 09:45:45.000 -0800' };

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
              const narmalizedRow = {};
              Object.keys(row).forEach((key) => {
                narmalizedRow[key] = testUtil.normalizeRowObject(row[key]);
              });
              assert.deepStrictEqual(narmalizedRow, expected);
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
        ' \'bd\': 3.3, ' +
        '\'bool\': true, ' +
        '\'timestamp_ltz\': \'2021-12-22 09:43:44\'::TIMESTAMP_LTZ,' +
        ' \'timestamp_ntz\': \'2021-12-23 09:44:44\'::TIMESTAMP_NTZ, ' +
        '\'timestamp_tz\': \'2021-12-24 09:45:45 -0800\'::TIMESTAMP_TZ,' +
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
        'timestamp_ltz TIMESTAMP_LTZ,' +
        'timestamp_ntz TIMESTAMP_NTZ, ' +
        'timestamp_tz TIMESTAMP_TZ, ' +
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
          timestamp_ltz: '2021-12-22 09:43:44.000 -0800',
          timestamp_ntz: '2021-12-23 09:44:44.000',
          timestamp_tz: '2021-12-24 09:45:45.000 -0800',
          date: '2023-12-23',
          time: '03:34:56',
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

    it('test object all types fetch as string', function (done) {
      const selectObject = 'select {\'string\': \'a\'' +
        ', \'b\': 1, ' +
        '\'s\': 2, ' +
        '\'i\': 3, ' +
        '\'l\': 4,' +
        ' \'f\': 1.1,' +
        ' \'d\': 2.2,' +
        ' \'bd\': 3.3, ' +
        '\'bool\': true, ' +
        '\'timestamp_ltz\': \'2021-12-22 09:43:44\'::TIMESTAMP_LTZ,' +
        ' \'timestamp_ntz\': \'2021-12-23 09:44:44\'::TIMESTAMP_NTZ, ' +
        '\'timestamp_tz\': \'2021-12-24 09:45:45 -0800\'::TIMESTAMP_TZ,' +
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
        'timestamp_ltz TIMESTAMP_LTZ,' +
        'timestamp_ntz TIMESTAMP_NTZ, ' +
        'timestamp_tz TIMESTAMP_TZ, ' +
        'date DATE, time TIME, ' +
        'binary BINARY' +
        ') AS RESULT';

      const expected = {
        'RESULT': '{"string":"a","b":1,"s":2,"i":3,"l":4,"f":1.1,"d":2.2,"bd":3.3,"bool":true,"timestamp_ltz":"2021-12-22 09:43:44.000 -0800","timestamp_ntz":"2021-12-23 09:44:44.000","timestamp_tz":"2021-12-24 09:45:45.000 -0800","date":"2023-12-23","time":"03:34:56","binary":[97,98,99]}'
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

    // it('test nested object', function (done) {
    //   const selectObject = 'select {\'inside\': {\'string\':\'a\'}}::OBJECT(inside OBJECT(string VARCHAR)) as result';
    //
    //   async.series([
    //     function (callback) {
    //       testUtil.executeQueryAndVerify(
    //         connection,
    //         selectObject,
    //         [{ RESULT: { 'string': 'a' } }],
    //         callback
    //       );
    //     }],
    //   done
    //   );
    // });
  });
});
