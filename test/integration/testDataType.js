const async = require('async');
const GlobalConfig = require('./../../lib/global_config');
const snowflake = require('./../../lib/snowflake');
const testUtil = require('./testUtil');
const sharedStatement = require('./sharedStatements');
const bigInt = require('big-integer');

describe('Test DataType', function () {
  let connection;
  const createTableWithString = 'create or replace table testString(colA string)';
  const createTableWithVariant = 'create or replace table testVariant(colA variant)';
  const createTableWithArray = 'create or replace table testArray(colA array)';
  const createTableWithNumber = 'create or replace table testNumber(colA number)';
  const createTableWithDouble = 'create or replace table testDouble(colA double)';
  const createTableWithDate = 'create or replace table testDate(colA date)';
  const createTableWithTime = 'create or replace table testTime(colA time)';
  const createTableWithTimestamp = 'create or replace table testTimestamp(colA timestamp_ltz, ' +
    'colB timestamp_tz, colC timestamp_ntz)';
  const createTableWithBoolean = 'create or replace table testBoolean(colA boolean, colB boolean, colC boolean)';
  const dropTableWithString = 'drop table if exists testString';
  const dropTableWithVariant = 'drop table if exists testVariant';
  const dropTableWithArray = 'drop table if exists testArray';
  const dropTableWithNumber = 'drop table if exists testNumber';
  const dropTableWithDouble = 'drop table if exists testDouble';
  const dropTableWithDate = 'drop table if exists testDate';
  const dropTableWithTime = 'drop table if exists testTime';
  const dropTableWithTimestamp = 'drop table if exists testTimestamp';
  const dropTableWithBoolean = 'drop table if exists testBoolean';
  const truncateTableWithVariant = 'truncate table if exists testVariant;';
  const insertDouble = 'insert into testDouble values(123.456)';
  const insertLargeNumber = 'insert into testNumber values (12345678901234567890123456789012345678)';
  const insertRegularSizedNumber = 'insert into testNumber values (100000001)';
  const insertVariantJSON = 'insert into testVariant select parse_json(\'{a : 1 , b :[1 , 2 , 3, -Infinity, undefined], c : {a : 1}}\')';
  const insertVariantJSONForCustomParser = 'insert into testVariant select parse_json(\'{a : 1 , b :[1 , 2 , 3], c : {a : 1}}\')';
  const insertVariantXML = 'insert into testVariant select parse_xml(\'<root><a>1</a><b>1</b><c><a>1</a></c></root>\')';
  const insertArray = 'insert into testArray select parse_json(\'["a", 1]\')';
  const insertDate = 'insert into testDate values(to_date(\'2012-11-11\'))';
  const insertTime = 'insert into testTime values(to_time(\'12:34:56.789789789\'))';
  const insertTimestamp = 'insert into testTimestamp values(to_timestamp_ltz('
    + '\'Thu, 21 Jan 2016 06:32:44 -0800\'), to_timestamp_tz(\'Thu, 21 Jan 2016 06:32:44 -0800\'), '
    + 'to_timestamp_ntz(\'Thu, 21 Jan 2016 06:32:44 -0800\'))';
  const insertBoolean = 'insert into testBoolean values(true, false, null)';
  const insertString = 'insert into testString values(\'string with space\')';
  const selectDouble = 'select * from testDouble';
  const selectNumber = 'select * from testNumber';
  const selectVariant = 'select * from testVariant';
  const selectArray = 'select * from testArray';
  const selectDate = 'select * from testDate';
  const selectTime = 'select * from testTime';
  const selectTimestamp = 'select * from testTimestamp';
  const selectBoolean = 'select * from testBoolean';
  const selectString = 'select * from testString';

  before(function (done) {
    connection = testUtil.createConnection();
    async.series([
      function (callback) {
        testUtil.connect(connection, callback);
      }],
    done
    );
  });

  after(function (done) {
    async.series([
      function (callback) {
        testUtil.executeCmd(connection, dropTableWithString, callback);
      },
      function (callback) {
        testUtil.executeCmd(connection, dropTableWithVariant, callback);
      },
      function (callback) {
        testUtil.executeCmd(connection, dropTableWithArray, callback);
      },
      function (callback) {
        testUtil.executeCmd(connection, dropTableWithNumber, callback);
      },
      function (callback) {
        testUtil.executeCmd(connection, dropTableWithDouble, callback);
      },
      function (callback) {
        testUtil.executeCmd(connection, dropTableWithDate, callback);
      },
      function (callback) {
        testUtil.executeCmd(connection, dropTableWithTime, callback);
      },
      function (callback) {
        testUtil.executeCmd(connection, dropTableWithTimestamp, callback);
      },
      function (callback) {
        testUtil.executeCmd(connection, dropTableWithBoolean, callback);
      },
      function (callback) {
        testUtil.destroyConnection(connection, callback);
      }],
    done
    );
  });

  describe('testNumber', function () {
    it('testDouble', function (done) {
      async.series([
        function (callback) {
          testUtil.executeCmd(connection, createTableWithDouble, callback);
        },
        function (callback) {
          testUtil.executeCmd(connection, insertDouble, callback);
        },
        function (callback) {
          testUtil.executeQueryAndVerify(
            connection,
            selectDouble,
            [{ 'COLA': 123.456 }],
            callback
          );
        }],
      done
      );
    });

    it('testLargeNumber', function (done) {
      async.series([
        function (callback) {
          testUtil.executeCmd(connection, createTableWithNumber, callback);
        },
        function (callback) {
          testUtil.executeCmd(connection, insertLargeNumber, callback);
        },
        function (callback) {
          testUtil.executeQueryAndVerify(
            connection,
            selectNumber,
            [{ 'COLA': 1.2345678901234568e+37 }],
            callback
          );
        }],
      done
      );
    });

    it('testLargeNumberBigInt', function (done) {
      async.series([
        function (callback) {
          testUtil.executeCmd(connection, createTableWithNumber, callback);
        },
        function (callback) {
          testUtil.executeCmd(connection, insertLargeNumber, callback);
        },
        function (callback) {
          testUtil.executeCmd(connection, 'alter session set JS_TREAT_INTEGER_AS_BIGINT=true', callback);
        },
        function (callback) {
          testUtil.executeQueryAndVerify(
            connection,
            selectNumber,
            [{ 'COLA': bigInt('12345678901234567890123456789012345678') }], // pragma: allowlist secret
            callback,
            null,
            false
          );
        }],
      done
      );
    });

    it('testRegularSizedInteger', function (done) {
      async.series([
        function (callback) {
          testUtil.executeCmd(connection, createTableWithNumber, callback);
        },
        function (callback) {
          testUtil.executeCmd(connection, insertRegularSizedNumber, callback);
        },
        function (callback) {
          testUtil.executeQueryAndVerify(
            connection,
            selectNumber,
            [{ 'COLA': 100000001 }],
            callback
          );
        }],
      done
      );
    });
  });

  describe('testSemiStructuredDataType', function () {
    describe('testVariant', function () {
      before(async () => {
        await testUtil.executeCmdAsync(connection, createTableWithVariant);
      });

      after(async () => {
        await testUtil.executeCmdAsync(connection, dropTableWithVariant);
      });

      afterEach(async () => {
        await testUtil.executeCmdAsync(connection, truncateTableWithVariant);
      });

      it('testJSON', function (done) {
        async.series(
          [
            function (callback) {
              testUtil.executeCmd(connection, insertVariantJSON, callback);
            },
            function (callback) {
              testUtil.executeQueryAndVerify(
                connection,
                selectVariant,
                [{ 'COLA': { a: 1, b: [1, 2, 3, -Infinity, undefined], c: { a: 1 } } }],
                callback,
                null,
                true,
                false
              );
            }],
          done
        );
      });

      it('testXML', function (done) {
        async.series(
          [
            function (callback) {
              testUtil.executeCmd(connection, insertVariantXML, callback);
            },
            function (callback) {
              testUtil.executeQueryAndVerify(
                connection,
                selectVariant,
                [{ 'COLA': { root: { a: 1, b: 1, c: { a: 1 } } } }],
                callback,
                null,
                true,
                false
              );
            }],
          done
        );
      });

      describe('testCustomParser', function () {
        let originalParserConfig;

        before(() => {
          originalParserConfig = {
            jsonColumnVariantParser: GlobalConfig.jsonColumnVariantParser,
            xmlColumnVariantParser: GlobalConfig.xmlColumnVariantParser
          };
        });

        after(() => {
          snowflake.configure(originalParserConfig);
        });

        it('testJSONCustomParser', function (done) {
          async.series(
            [
              function (callback) {
                snowflake.configure({
                  jsonColumnVariantParser: rawColumnValue => JSON.parse(rawColumnValue)
                });
                testUtil.executeCmd(connection, insertVariantJSONForCustomParser, callback);
              },
              function (callback) {
                testUtil.executeQueryAndVerify(
                  connection,
                  selectVariant,
                  [{ 'COLA': { a: 1, b: [1, 2, 3,], c: { a: 1 } } }],
                  callback
                );
              }
            ],
            done
          );
        });

        // TODO SNOW - 830291: add custom xml parser test
        //it('testXMLCustomParser', function (done) {});
      });
    });

    it('testArray', function (done) {
      async.series(
        [
          function (callback) {
            testUtil.executeCmd(connection, createTableWithArray, callback);
          },
          function (callback) {
            testUtil.executeCmd(connection, insertArray, callback);
          },
          function (callback) {
            testUtil.executeQueryAndVerify(
              connection,
              selectArray,
              [{ 'COLA': ['a', 1] }],
              callback,
              null,
              true,
              false
            );
          }],
        done
      );
    });
  });

  describe('testDateTime', function () {
    it('testDate', function (done) {
      async.series(
        [
          function (callback) {
            testUtil.executeCmd(connection, createTableWithDate, callback);
          },
          function (callback) {
            testUtil.executeCmd(connection, insertDate, callback);
          },
          function (callback) {
            testUtil.executeQueryAndVerify(
              connection,
              selectDate,
              [{ 'COLA': '2012-11-11' }],
              callback
            );
          }],
        done
      );
    });

    it('testTime', function (done) {
      async.series(
        [
          function (callback) {
            testUtil.executeCmd(connection, createTableWithTime, callback);
          },
          function (callback) {
            testUtil.executeCmd(connection, insertTime, callback);
          },
          function (callback) {
            testUtil.executeQueryAndVerify(
              connection,
              selectTime,
              [{ 'COLA': '12:34:56' }],
              callback
            );
          }],
        done
      );
    });

    it('testTimestamp', function (done) {
      async.series(
        [
          function (callback) {
            testUtil.executeCmd(connection, createTableWithTimestamp, callback);
          },
          function (callback) {
            testUtil.executeCmd(connection, insertTimestamp, callback);
          },
          function (callback) {
            testUtil.executeCmd(connection, sharedStatement.setTimezoneAndTimestamps, callback);
          },
          function (callback) {
            testUtil.executeQueryAndVerify(
              connection,
              selectTimestamp,
              [{
                'COLA': '2016-01-21 06:32:44.000 -0800',
                'COLB': '2016-01-21 06:32:44.000 -0800',
                'COLC': '2016-01-21 06:32:44.000'
              }],
              callback
            );
          }],
        done
      );
    });
  });

  describe('testBoolean', function () {
    it('testTrue', function (done) {
      async.series(
        [
          function (callback) {
            testUtil.executeCmd(connection, createTableWithBoolean, callback);
          },
          function (callback) {
            testUtil.executeCmd(connection, insertBoolean, callback);
          },
          function (callback) {
            testUtil.executeQueryAndVerify(
              connection,
              selectBoolean,
              [{
                'COLA': true,
                'COLB': false,
                'COLC': null
              }],
              callback
            );
          }],
        done
      );
    });
  });

  describe('testText', function () {
    it('testString', function (done) {
      async.series(
        [
          function (callback) {
            testUtil.executeCmd(connection, createTableWithString, callback);
          },
          function (callback) {
            testUtil.executeCmd(connection, insertString, callback);
          },
          function (callback) {
            testUtil.executeQueryAndVerify(
              connection,
              selectString,
              [{ 'COLA': 'string with space' }],
              callback
            );
          }],
        done
      );
    });
  });
});
