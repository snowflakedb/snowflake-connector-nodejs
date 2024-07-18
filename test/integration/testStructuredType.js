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
      }],
    done
    );
  });

  describe('test object', function () {
    it('test simple object', function (done) {
      const selectObject = 'select {\'string\':\'a\'}::OBJECT(string VARCHAR) as result';

      async.series([
        function (callback) {
          testUtil.executeCmd(connection, 'alter session set ENABLE_STRUCTURED_TYPES_IN_CLIENT_RESPONSE = true', callback);
        },
        function (callback) {
          testUtil.executeCmd(connection, 'alter session set IGNORE_CLIENT_VESRION_IN_STRUCTURED_TYPES_RESPONSE = true', callback);
        },
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
      async.series([
        function (callback) {
          const executeOptions = {};
          executeOptions.sqlText = selectObject;
          executeOptions.complete = function (err, stmt) {
            assert.ok(!err, JSON.stringify(err));
            let rowCount = 0;
            const stream = stmt.streamRows();

            stream.on('readable', function () {
              let row;
              while ((row = stream.read()) !== null) {
                const narmalizedRow = {};
                const expected = {};
                Object.keys(row).forEach((key) => {
                  narmalizedRow[key] = testUtil.normalizeRowObject(row[key]);
                });
                expected.timestamp_ltz = '2021-12-22 09:43:44.000 -0800';
                assert.deepStrictEqual(narmalizedRow.RESULT, expected);
                rowCount++;
              }
            });
            stream.on('error', function (err) {
              assert.ok(!err, JSON.stringify(err));
            });
            stream.on('end', function () {
              assert.strictEqual(rowCount, 1);
              callback();
              done();
            });
          };
          connection.execute(executeOptions);
        }
      ]
      );

    });

    it('test timestamp ltz fetch as string', function (done) {
      const selectObject = 'select {' +
        '\'timestamp_ltz\': \'2021-12-22 09:43:44\'::TIMESTAMP_LTZ' +
        '}' +
        '::OBJECT(timestamp_ltz TIMESTAMP_LTZ) As RESULT';
      async.series([
        function (callback) {
          const executeOptions = {};
          executeOptions.sqlText = selectObject;
          executeOptions.fetchAsString = [snowflake.OBJECT];
          executeOptions.complete = function (err, stmt) {
            assert.ok(!err, JSON.stringify(err));
            let rowCount = 0;
            const stream = stmt.streamRows();
            stream.on('readable', function () {
              let row;
              while ((row = stream.read()) !== null) {
                const expected = '{"timestamp_ltz":"2021-12-22 09:43:44.000 -0800"}';
                assert.deepStrictEqual(row.RESULT, expected);
                rowCount++;
                rowCount++;
              }
            });
            stream.on('error', function (err) {
              assert.ok(!err, JSON.stringify(err));
            });
            stream.on('end', function () {
              callback();
            });
          };
          connection.execute(executeOptions);
        }],
      done
      );
    });

    it('test timestamp ntz', function (done) {
      const selectObject = 'select {' +
        '\'timestamp_ntz\': \'2021-12-22 09:43:44\'::TIMESTAMP_NTZ' +
        '}' +
        '::OBJECT(timestamp_ntz TIMESTAMP_NTZ) AS RESULT';
      async.series([
        function (callback) {
          const executeOptions = {};
          executeOptions.sqlText = selectObject;
          executeOptions.complete = function (err, stmt) {
            assert.ok(!err, JSON.stringify(err));
            let rowCount = 0;
            const stream = stmt.streamRows();

            stream.on('readable', function () {
              let row;
              while ((row = stream.read()) !== null) {
                const narmalizedRow = {};
                const expected = {};
                Object.keys(row).forEach((key) => {
                  narmalizedRow[key] = testUtil.normalizeRowObject(row[key]);
                });
                expected.timestamp_ntz = '2021-12-22 09:43:44.000';
                console.log(narmalizedRow);
                assert.deepStrictEqual(narmalizedRow.RESULT, expected);
                rowCount++;
              }
            });
            stream.on('error', function (err) {
              assert.ok(!err, JSON.stringify(err));
            });
            stream.on('end', function () {
              assert.strictEqual(rowCount, 1);
              callback();
              done();
            });
          };
          connection.execute(executeOptions);
        }
      ]
      );

    });

    it('test timestamp tz', function (done) {
      const selectObject = 'select {' +
        '\'timestamp_tz\': \'2021-12-24 09:45:45 -0800\'::TIMESTAMP_TZ' +
        '}' +
        '::OBJECT(timestamp_tz TIMESTAMP_TZ) AS RESULT';
      async.series([
        function (callback) {
          testUtil.executeCmd(connection, sharedStatement.setTimezoneAndTimestamps, callback);
        },
        function (callback) {
          const executeOptions = {};
          executeOptions.sqlText = selectObject;
          executeOptions.complete = function (err, stmt) {
            assert.ok(!err, JSON.stringify(err));
            let rowCount = 0;
            const stream = stmt.streamRows();

            stream.on('readable', function () {
              let row;
              while ((row = stream.read()) !== null) {
                const narmalizedRow = {};
                const expected = {};
                Object.keys(row).forEach((key) => {
                  narmalizedRow[key] = testUtil.normalizeRowObject(row[key]);
                });
                expected.timestamp_tz = '2021-12-24 09:45:45.000 -0800';
                assert.deepStrictEqual(narmalizedRow.RESULT, expected);
                rowCount++;
              }
            });
            stream.on('error', function (err) {
              assert.ok(!err, JSON.stringify(err));
            });
            stream.on('end', function () {
              assert.strictEqual(rowCount, 1);
              callback();
              done();
            });
          };
          connection.execute(executeOptions);
        }
      ]
      );

    });

    it('test binary', function (done) {
      const selectObject = 'select {' +
        '\'binary\': TO_BINARY(\'616263\', \'HEX\')' +
        '}' +
        '::OBJECT(binary BINARY) As RESULT';
      async.series([
        function (callback) {
          testUtil.executeQueryAndVerify(
            connection,
            selectObject,
            [{ RESULT: { 'binary': [97, 98, 99] } }],
            callback
          );
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

      const expected = { RESULT: {} };
      expected.RESULT = { string: 'a',
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
        binary: [97, 98, 99] };

      async.series([
        function (callback) {
          testUtil.executeCmd(connection, sharedStatement.setTimezoneAndTimestamps, callback);
        },
        function (callback) {
          const executeOptions = {};
          executeOptions.sqlText = selectObject;
          executeOptions.complete = function (err, stmt) {
            assert.ok(!err, JSON.stringify(err));
            let rowCount = 0;
            const stream = stmt.streamRows();
            stream.on('readable', function () {
              let row;
              while ((row = stream.read()) !== null) {
                const narmalizedRow = {};
                Object.keys(row).forEach((key) => {
                  narmalizedRow[key] = testUtil.normalizeRowObject(row[key]);
                });
                assert.deepStrictEqual(narmalizedRow, expected);
                rowCount++;
              }
            });
            stream.on('error', function (err) {
              assert.ok(!err, JSON.stringify(err));
            });
            stream.on('end', function () {
              assert.strictEqual(rowCount, 1);
              callback();
            });
          };
          connection.execute(executeOptions);
        }],
      done
      );
    });
  });

});
