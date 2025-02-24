const async = require('async');
const assert = require('assert');
const testUtil = require('./testUtil');
const util = require('util');
const sharedStatement = require('./sharedStatements');

describe('Test Bind Varible', function () {
  let connection;
  const createTestTbl = 'create or replace table testTbl(colA string, colB number)';
  const dropTestTbl = 'drop table if exists testTbl';
  const insertWithQmark = 'insert into testTbl values(?, ?)';
  const insertWithSemiColon = 'insert into testTbl values(:1, :2)';
  const insertValue = 'insert into testTbl values(\'string\', 3)';
  const insertSingleBind = 'insert into testTbl values(?)';
  const selectAllFromTbl = 'select * from testTbl order by 1';
  const selectAllFromTblLimit1 = 'select * from testTbl order by 1 limit ?';
  const selectWithBind = 'select * from testTbl where COLA = :2 and COLB = :1';

  before(function (done) {
    connection = testUtil.createConnection();
    async.series(
      [
        function (callback) {
          testUtil.connect(connection, callback);
        }
      ],
      done
    );
  });

  after(function (done) {
    async.series(
      [
        function (callback) {
          testUtil.destroyConnection(connection, callback);
        }
      ],
      done
    );
  });

  it('testBindWithQmark', function (done) {
    async.series(
      [
        function (callback) {
          testUtil.executeCmd(connection, createTestTbl, callback);
        },
        function (callback) {
          testUtil.executeCmd(
            connection,
            insertWithQmark,
            callback,
            ['string', 3]
          );
        },
        function (callback) {
          testUtil.executeQueryAndVerify(
            connection,
            selectAllFromTbl,
            [{
              'COLA': 'string',
              'COLB': 3
            }],
            callback
          );
        },
        function (callback) {
          testUtil.executeCmd(connection, dropTestTbl, callback);
        }
      ],
      done
    );
  });

  it('testBindArrayWithQmark', function (done) {
    async.series(
      [
        function (callback) {
          testUtil.executeCmd(connection, createTestTbl, callback);
        },
        function (callback) {
          testUtil.executeCmd(
            connection,
            insertWithQmark,
            callback,
            [['string3', 6], ['string2', 4], ['string1', 2]]
          );
        },
        function (callback) {
          testUtil.executeQueryAndVerify(
            connection,
            selectAllFromTbl,
            [
              { 'COLA': 'string1', 'COLB': 2 },
              { 'COLA': 'string2', 'COLB': 4 },
              { 'COLA': 'string3', 'COLB': 6 }
            ],
            callback
          );
        },
        function (callback) {
          testUtil.executeCmd(connection, dropTestTbl, callback);
        }
      ],
      done
    );
  });

  it('testBindWithSemiColon', function (done) {
    async.series(
      [
        function (callback) {
          testUtil.executeCmd(connection, createTestTbl, callback);
        },
        function (callback) {
          testUtil.executeCmd(
            connection,
            insertWithSemiColon,
            callback,
            ['string', 3]
          );
        },
        function (callback) {
          testUtil.executeQueryAndVerify(
            connection,
            selectAllFromTbl,
            [{
              'COLA': 'string',
              'COLB': 3
            }],
            callback
          );
        }
      ],
      done
    );
  });

  it('testBindInPredicate', function (done) {
    async.series(
      [
        function (callback) {
          testUtil.executeCmd(connection, createTestTbl, callback);
        },
        function (callback) {
          testUtil.executeCmd(connection, insertValue, callback);
        },
        function (callback) {
          testUtil.executeQueryAndVerify(
            connection,
            selectWithBind,
            [{
              'COLA': 'string',
              'COLB': 3
            }],
            callback,
            [3, 'string']
          );
        },
        function (callback) {
          testUtil.executeCmd(connection, dropTestTbl, callback);
        }
      ],
      done
    );
  });

  it('testBindNull', function (done) {
    async.series(
      [
        function (callback) {
          // create a new table with two columns, colA and colB
          testUtil.executeCmd(connection, createTestTbl, callback);
        },
        function (callback) {
          // use binds to insert a null value for colA into the table
          connection.execute(
            {
              sqlText: insertWithSemiColon,
              binds: [null, 3],
              complete: function (err) {
                assert.ok(!err);
                callback();
              }
            });
        },
        function (callback) {
          // check that the value of colA in the inserted row is indeed null
          connection.execute(
            {
              sqlText: 'select * from testTbl where colA is null',
              complete: function (err, statement, rows) {
                assert.ok(!err);
                assert.ok(util.isArray(rows));
                assert.ok(rows.length === 1);
                callback();
              }
            });
        },
        function (callback) {
          testUtil.executeCmd(connection, dropTestTbl, callback);
        }
      ],
      done);
  });

  it('testWrongBinds', function (done) {
    const wrongBindsOptions =
      [
        {
          // empty binds array
          sqlText: insertWithSemiColon,
          binds: [],
          verifyResults: function (err) {
            assert.ok(err);
            assert.strictEqual('002049', err['code']);
          }
        },
        {
          //wrong binds data type
          sqlText: insertWithSemiColon,
          binds: [3, 'string'],
          verifyResults: function (err) {
            assert.ok(err);
            assert.strictEqual('100038', err['code']);
          }
        },
        {
          // no binds array
          sqlText: insertWithSemiColon,
          verifyResults: function (err) {
            assert.ok(err);
            assert.strictEqual('002049', err['code']);
          }
        },
        //these three testcases won't return an error
        {
          // more binds entry in the array
          sqlText: insertWithSemiColon,
          binds: ['string', 3, 3],
          verifyResults: function (err) {
            testUtil.checkError(err);
          }
        },
        {
          //no qmark or semicolon but with binds
          sqlText: insertValue,
          binds: ['string', 3],
          verifyResults: function (err) {
            testUtil.checkError(err);
          }
        },
        {
          sqlText: 'insert into testTbl values(?, :2)',
          binds: ['string2', 4],
          verifyResults: function (err) {
            testUtil.checkError(err);
          }
        },
        {
          sqlText: 'insert into testTbl values(:2, 3)',
          binds: [5, 'string'],
          verifyResults: function (err) {
            testUtil.checkError(err);
          }
        }
      ];

    async.series(
      [
        function (callback) {
          testUtil.executeCmd(connection, createTestTbl, callback);
        },
        function (callback) {
          const executeWrongBindsOption = function (index) {
            if (index < wrongBindsOptions.length) {
              const option = wrongBindsOptions[index];
              option.complete = function (err, stmt) {
                option.verifyResults(err, stmt);
                executeWrongBindsOption(index + 1);
              };
              connection.execute(option);
            } else {
              callback();
            }
          };

          executeWrongBindsOption(0);
        },
        function (callback) {
          testUtil.executeCmd(connection, dropTestTbl, callback);
        }
      ],
      done
    );
  });

  it('testBindsSameSQLWithDifferentValue', function (done) {
    async.series(
      [
        function (callback) {
          testUtil.executeCmd(connection, createTestTbl, callback);
        },
        function (callback) {
          const bindSets = [
            ['string2', 4],
            ['string3', 5],
            ['string4', 6]
          ];

          const insertWithDifferentBinds = function (i) {
            if (i < bindSets.length) {
              testUtil.executeCmd(
                connection,
                insertWithQmark,
                function () {
                  insertWithDifferentBinds(i + 1);
                },
                bindSets[i]
              );
            } else {
              callback();
            }
          };

          insertWithDifferentBinds(0);
        },
        function (callback) {
          const expected = [
            { 'COLA': 'string2', 'COLB': 4 },
            { 'COLA': 'string3', 'COLB': 5 },
            { 'COLA': 'string4', 'COLB': 6 }
          ];
          testUtil.executeQueryAndVerify(
            connection,
            selectAllFromTbl,
            expected,
            callback
          );
        }
      ],
      done
    );
  });

  it('testBindsVariableReuse', function (done) {
    async.series(
      [
        function (callback) {
          testUtil.executeCmd(
            connection,
            'create or replace table testTbl(colA string, colB string, colC string)',
            callback);
        },
        function (callback) {
          testUtil.executeCmd(
            connection,
            'insert into testTbl values(:1, :1, :1)',
            callback,
            ['string']
          );
        },
        function (callback) {
          testUtil.executeQueryAndVerify(
            connection,
            selectAllFromTbl,
            [{
              'COLA': 'string',
              'COLB': 'string',
              'COLC': 'string'
            }],
            callback
          );
        },
        function (callback) {
          testUtil.executeCmd(connection, dropTestTbl, callback);
        }
      ],
      done
    );
  });

  describe('testBindingWithDifferentDataType', function () {
    const testingFunc = function (dataType, binds, expected, callback) {
      async.series(
        [
          function (callback) {
            testUtil.executeCmd(
              connection,
              sharedStatement.setTimezoneAndTimestamps,
              callback
            );
          },
          function (callback) {
            testUtil.executeCmd(
              connection,
              'create or replace table testTbl(colA ' + dataType + ');',
              callback
            );
          },
          function (callback) {
            testUtil.executeCmd(
              connection,
              insertSingleBind,
              callback,
              binds
            );
          },
          function (callback) {
            testUtil.executeQueryAndVerify(
              connection,
              selectAllFromTbl,
              expected,
              callback
            );
          },
          function (callback) {
            testUtil.executeCmd(connection, dropTestTbl, callback);
          }
        ],
        callback
      );
    };

    it('testBindLimitClause', function (done) {
      async.series(
        [
          function (callback) {
            testUtil.executeCmd(connection, createTestTbl, callback);
          },
          function (callback) {
            testUtil.executeCmd(
              connection,
              insertWithQmark,
              callback,
              [['string', 3], ['string2', 4]]
            );
          },
          function (callback) {
            testUtil.executeQueryAndVerify(
              connection,
              selectAllFromTblLimit1,
              [{
                'COLA': 'string',
                'COLB': 3
              }],
              callback,
              [1]
            );
          },
          function (callback) {
            testUtil.executeCmd(connection, dropTestTbl, callback);
          }
        ],
        done
      );
    });


    it('testBindingBooleanSimple', function (done) {
      testingFunc(
        'boolean',
        [true],
        [{ 'COLA': true }],
        done
      );
    });

    it('testBindingDateSimple', function (done) {
      testingFunc(
        'date',
        ['2012-11-11'],
        [{ 'COLA': '2012-11-11' }],
        done
      );
    });

    it('testBindingTimeSimple', function (done) {
      testingFunc(
        'time',
        ['12:34:56.789789789'],
        [{ 'COLA': '12:34:56' }],
        done
      );
    });

    it('testBindingTimestampLTZSimple', function (done) {
      testingFunc(
        'timestamp_ltz',
        ['Thu, 21 Jan 2016 06:32:44 -0800'],
        [{ 'COLA': '2016-01-21 06:32:44.000 -0800' }],
        done
      );
    });

    it('testBindingTimestampTZSimple', function (done) {
      testingFunc(
        'timestamp_tz',
        ['Thu, 21 Jan 2016 06:32:44 -0800'],
        [{ 'COLA': '2016-01-21 06:32:44.000 -0800' }],
        done
      );
    });

    it('testBindingTimestampNTZSimple', function (done) {
      testingFunc(
        'timestamp_ntz',
        ['Thu, 21 Jan 2016 06:32:44 -0800'],
        [{ 'COLA': '2016-01-21 06:32:44.000' }],
        done
      );
    });

    it('testBindingTimestampNTZDate', function (done) {
      testingFunc(
        'timestamp_ntz',
        [new Date('Thu, 21 Jan 2016 06:32:44 -0800')],
        [{ 'COLA': '2016-01-21 14:32:44.000' }],
        done
      );
    });

    /*it('testBindingVariantSimple', function(done){
      var variant = {'a':1 , 'b':[1], 'c':{'a':1}};
      testingFunc(
        'variant',
        [variant],
        function(row){
          assert.deepEqual(row.getColumnValue(0), variant);
        },
        function(err, stmt){
          callback();
        }
      );
    });

    it('testBindingObjectSimple', function(done){
      var object = {'a':1 , 'b':[1], 'c':{'a':1}};
      testingFunc(
        'object',
        [object],
        function(row){
          assert.deepEqual(row.getColumnValue(0), object);
        },
        function(err, stmt){
          callback();
        }
      );
    });
    it('testBindingArraySimple', function(done){
      var array = ['a', 1, {'a':1}, [1, 'a']];
      testingFunc(
        'array',
        [array],
        function(row){
          assert.strictEqual(row.getColumnValue(0), array);
        },
        function(err, stmt){
          done();
        }
      );
    });*/
  });

  it('testBindMaliciousString', function (done) {
    async.series(
      [
        function (callback) {
          testUtil.executeCmd(connection, createTestTbl, callback);
        },
        function (callback) {
          testUtil.executeCmd(connection, insertValue, callback);
        },
        function (callback) {
          const maliciousOptions = [
            {
              sqlText: 'select * from testTbl where colA = ?',
              binds: ['a; drop table if exists testTbl']
            },
            {
              sqlText: 'select * from testTbl where colA = ?',
              binds: ['$*~?\':1234567890!@#$%^&*()_=']
            }
          ];
          const selectWithOption = function (i) {
            if (i < maliciousOptions.length) {
              testUtil.executeQueryAndVerify(
                connection,
                maliciousOptions[i].sqlText,
                [],
                function () {
                  selectWithOption(i + 1);
                },
                maliciousOptions[i].binds
              );
            } else {
              callback();
            }
          };

          selectWithOption(0);
        }
      ],
      done
    );
  });
});
