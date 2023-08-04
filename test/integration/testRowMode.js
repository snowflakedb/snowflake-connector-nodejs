/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
const assert = require('assert');
const testUtil = require('./testUtil');
const RowMode = require('./../../lib/constants/row_mode');


describe('Test row mode', function () {
  this.timeout(5000);
  let connection;
  const sql = `select *
               from (select 'a' as key, 1 as foo, 3 as name) as table1
                        join (select 'a' as key, 2 as foo, 3 as name2) as table2 on table1.key = table2.key
                        join (select 'a' as key, 3 as foo) as table3 on table1.key = table3.key`;

  const expectedArray = ['a', 1, 3, 'a', 2, 3, 'a', 3];
  const expectedObject = {KEY: 'a', FOO: 3, NAME: 3, NAME2: 3};
  const expectedObjectWithRenamedDuplicatedColumns = {KEY: 'a', FOO: 1, NAME: 3, KEY_2: 'a', FOO_2: 2, NAME2: 3, KEY_3: 'a', FOO_3: 3};

  const testCases = [
    {
      connectionRowMode: RowMode.OBJECT,
      statementRowModes: [
      {
        rowMode: RowMode.ARRAY,
        expected: expectedArray
      },
      {
        rowMode: RowMode.OBJECT_WITH_RENAMED_DUPLICATED_COLUMNS,
        expected: expectedObjectWithRenamedDuplicatedColumns
      },
      {
        rowMode: undefined,
        expected: expectedObject
      }
      ]
    },
    {
      connectionRowMode: RowMode.ARRAY,
      statementRowModes: [
        {
          rowMode: undefined,
          expected: expectedArray
        },
        {
          rowMode: RowMode.OBJECT_WITH_RENAMED_DUPLICATED_COLUMNS,
          expected: expectedObjectWithRenamedDuplicatedColumns
        },
        {
          rowMode: RowMode.OBJECT,
          expected: expectedObject
        },
      ]
    },
    {
      connectionRowMode: RowMode.OBJECT_WITH_RENAMED_DUPLICATED_COLUMNS,
      statementRowModes: [
        {
          rowMode: undefined,
          expected: expectedObjectWithRenamedDuplicatedColumns
        },
        {
          rowMode: RowMode.ARRAY,
          expected: expectedArray
        },
        {
          rowMode: RowMode.OBJECT,
          expected: expectedObject
        },
      ]
    }
  ];


  testCases.forEach(({connectionRowMode, statementRowModes }) => {
    describe(`rowMode ${connectionRowMode} in connection`, function () {
      before(function (done) {
        connection = testUtil.createConnection({rowMode: connectionRowMode});
        testUtil.connect(connection, done);
      });
      after(function (done) {
        testUtil.destroyConnection(connection, done);
      });

      statementRowModes.forEach(({rowMode, expected}) => {
        describe(`rowMode ${rowMode} in statement`, function () {

          it('stream rows', function (done) {
            const stmt = connection.execute({
              sqlText: sql,
              rowMode: rowMode,
              streamResult: true
            });
            stmt.streamRows()
              .on('data', function (row) {
                assert.deepStrictEqual(row, expected);
              })
              .on('end', function () {
                done();
              })
              .on('error', function (err) {
                done(err);
              });
          });

          it('fetch rows', function (done) {
            connection.execute({
              sqlText: sql,
              rowMode: rowMode,
              streamResult: false,
              complete: function (err, stmt, rows) {
                if (err) {
                  done(err);
                } else {
                  assert.deepStrictEqual(rows[0], expected);
                  done();
                }
              }
            });
          });
        });
      });
    });
  });

  describe('test incorect row mode - connection', function () {
    it('test incorrect row mode', function (done) {
      try {
        connection = testUtil.createConnection({rowMode: 'invalid'});
      } catch (err) {
        assert.strictEqual(err.code, 411006);
        done();
      }
    });
  });

  describe('test incorect row mode - statement', function () {
    before(function (done) {
      connection = testUtil.createConnection();
      testUtil.connect(connection, done);
    });
    after(function (done) {
      testUtil.destroyConnection(connection, done);
    });

    it('test incorrect row mode', function (done) {
      try {
        connection.execute({
          rowMode: 'invalid',
          sqlText: sql,
          complete: function () {}
        });
      } catch (err) {
        assert.strictEqual(err.code, 411006);
        done();
      }
    });
  });

  describe('test correctly named columns for duplicates', function () {
    before(function (done) {
      connection = testUtil.createConnection();
      testUtil.connect(connection, done);
    });
    after(function (done) {
      testUtil.destroyConnection(connection, done);
    });

    it('test duplicates', function (done) {
      const expected = {
        "KEY": "a",
        "FOO": 1,
        "KEY_1": "a1",
        "FOO_2": 2,
        "KEY_3": "a2",
        "FOO_3": 3,
        "KEY_2": "a3",
        "FOO_4": 4,
        "KEY_4": "a4",
        "FOO_5": 5
      }
      connection.execute({
        rowMode: RowMode.OBJECT_WITH_RENAMED_DUPLICATED_COLUMNS,
        sqlText: `select *
                  from (select 'a' as key, 1 as foo, 
                         'a1' as key_1, 2 as foo, 
                         'a2' as key_3, 3 as foo_3, 
                         'a3' as key, 4 as foo,
                         'a4' as key, 5 as foo) as table1
        `,
        complete: function (err, stmt, rows) {
          if (err) {
            done(err);
          }
          assert.deepStrictEqual(rows[0], expected);
          done();
        }
      });
    });
  });
});
