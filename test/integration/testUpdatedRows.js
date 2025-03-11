const assert = require('assert');
const async = require('async');
const testUtil = require('./testUtil');

describe('Test updated rows', function () {
  let connection;
  const dropTableFoo = 'drop table if exists foo';
  const dropTableBar = 'drop table if exists bar';
  const dropTableFoo2 = 'drop table if exists foo2';
  const dropTableFooMaster = 'drop table if exists foomaster';
  const dropTableSource = 'drop table if exists source';

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
        testUtil.executeCmd(connection, dropTableFoo, callback);
      },
      function (callback) {
        testUtil.executeCmd(connection, dropTableFoo2, callback);
      },
      function (callback) {
        testUtil.executeCmd(connection, dropTableBar, callback);
      },
      function (callback) {
        testUtil.executeCmd(connection, dropTableFooMaster, callback);
      },
      function (callback) {
        testUtil.executeCmd(connection, dropTableSource, callback);
      },
      function (callback) {
        testUtil.destroyConnection(connection, callback);
      }],
    done
    );
  });

  describe('testUpdatedRows', function () {
    this.timeout(90000);

    it('insert, update, delete', function (done) {
      async.series([
        function (callback) {
          const sqlText = 'create or replace table foo (c1 number, c2 number);';
          connection.execute(
            {
              sqlText: sqlText,
              complete: function (err, statement) {
                assert.ok(!err);
                assert.strictEqual(statement.getNumUpdatedRows(), -1);
                callback();
              }
            });
        },
        function (callback) {
          const sqlText = 'insert into foo values' +
              ' (1,10)' +
              ',(2,10)' +
              ',(3,10)' +
              ',(4,10)' +
              ',(5,10)' +
              ',(6,10)' +
              ',(7,10)' +
              ',(8,10);';
          connection.execute(
            {
              sqlText: sqlText,
              complete: function (err, statement) {
                // 'number of rows inserted': 8
                assert.ok(!err);
                assert.strictEqual(statement.getNumUpdatedRows(), 8);
                callback();
              }
            });
        },
        function (callback) {
          const sqlText = 'create or replace table foo2 (c3 number, c4 number);';
          connection.execute(
            {
              sqlText: sqlText,
              complete: function (err, statement) {
                assert.ok(!err);
                assert.strictEqual(statement.getNumUpdatedRows(), -1);
                callback();
              }
            });
        },
        function (callback) {
          const sqlText = 'insert into foo2 values' +
              ' (1,5)' +
              ',(2,5)' +
              ',(3,5)' +
              ',(1,5)';
          connection.execute(
            {
              sqlText: sqlText,
              complete: function (err, statement) {
                // 'number of rows inserted': 4
                assert.ok(!err);
                assert.strictEqual(statement.getNumUpdatedRows(), 4);
                callback();
              }
            });
        },
        function (callback) {
          const sqlText =
              'update foo set c2 = c4 from foo2 where foo.c1 = foo2.c3;';
          connection.execute(
            {
              sqlText: sqlText,
              complete: function (err, statement) {
                // 'number of rows updated': 3
                // 'number of multi-joined rows updated': 1
                assert.ok(!err);
                assert.strictEqual(statement.getNumUpdatedRows(), 4);
                callback();
              }
            });
        },
        function (callback) {
          const sqlText = 'delete from foo;';
          connection.execute(
            {
              sqlText: sqlText,
              complete: function (err, statement) {
                // 'number of rows deleted': 8
                assert.ok(!err);
                assert.strictEqual(statement.getNumUpdatedRows(), 8);
                callback();
              }
            });
        }],
      done);
    });

    it('merge', function (done) {
      async.series([
        function (callback) {
          const sqlText = 'create or replace table fooMaster (k number, v number);';
          connection.execute(
            {
              sqlText: sqlText,
              complete: function (err, statement) {
                assert.ok(!err);
                assert.strictEqual(statement.getNumUpdatedRows(), -1);
                callback();
              }
            });
        },
        function (callback) {
          const sqlText = 'insert into fooMaster values (0, 10), (1, 11), (5, 15), (6, 16);';
          connection.execute(
            {
              sqlText: sqlText,
              complete: function (err, statement) {
                // 'number of rows inserted': 4
                assert.ok(!err);
                assert.strictEqual(statement.getNumUpdatedRows(), 4);
                callback();
              }
            });
        },
        function (callback) {
          const sqlText = 'create or replace table foo clone fooMaster;';
          connection.execute(
            {
              sqlText: sqlText,
              complete: function (err, statement) {
                assert.ok(!err);
                assert.strictEqual(statement.getNumUpdatedRows(), -1);
                callback();
              }
            });
        },
        function (callback) {
          const sqlText = 'create or replace table bar (k number, v number);';
          connection.execute(
            {
              sqlText: sqlText,
              complete: function (err, statement) {
                assert.ok(!err);
                assert.strictEqual(statement.getNumUpdatedRows(), -1);
                callback();
              }
            });
        },
        function (callback) {
          const sqlText = 'insert into bar values (0, 20), (1, 21), (2, 22), (3, 23), (4, 24);';
          connection.execute(
            {
              sqlText: sqlText,
              complete: function (err, statement) {
                // 'number of rows inserted': 5
                assert.ok(!err);
                assert.strictEqual(statement.getNumUpdatedRows(), 5);
                callback();
              }
            });
        },
        function (callback) {
          const sqlText = 'merge into foo using bar on foo.k = bar.k ' +
              'when matched and foo.k = 0 then update set v = bar.v*100 ' +
              'when matched and foo.k = 1 then delete ' +
              'when not matched then insert values (k,v);';
          connection.execute(
            {
              sqlText: sqlText,
              complete: function (err, statement) {
                // 'number of rows inserted': 3
                // 'number of rows updated': 1
                // 'number of rows deleted': 1
                assert.ok(!err);
                assert.strictEqual(statement.getNumUpdatedRows(), 5);
                callback();
              }
            });
        }],
      done);
    });

    it('multi-table insert', function (done) {
      async.series([
        function (callback) {
          const sqlText = 'create or replace table source(k number, v number);';
          connection.execute(
            {
              sqlText: sqlText,
              complete: function (err, statement) {
                assert.ok(!err);
                assert.strictEqual(statement.getNumUpdatedRows(), -1);
                callback();
              }
            });
        },
        function (callback) {
          const sqlText = 'insert into source values (0, 100), (1, 101), (2, 102);';
          connection.execute(
            {
              sqlText: sqlText,
              complete: function (err, statement) {
                // 'number of rows inserted': 3
                assert.ok(!err);
                assert.strictEqual(statement.getNumUpdatedRows(), 3);
                callback();
              }
            });
        },
        function (callback) {
          const sqlText = 'create or replace table foo (k number, v number);';
          connection.execute(
            {
              sqlText: sqlText,
              complete: function (err, statement) {
                assert.ok(!err);
                assert.strictEqual(statement.getNumUpdatedRows(), -1);
                callback();
              }
            });
        },
        function (callback) {
          const sqlText = 'create or replace table bar (k number, v number);';
          connection.execute(
            {
              sqlText: sqlText,
              complete: function (err, statement) {
                assert.ok(!err);
                assert.strictEqual(statement.getNumUpdatedRows(), -1);
                callback();
              }
            });
        },
        function (callback) {
          const sqlText = 'insert ALL into foo into bar select * from source;';
          connection.execute(
            {
              sqlText: sqlText,
              complete: function (err, statement) {
                // 'number of rows inserted into FOO': 3
                // 'number of rows inserted into BAR': 3
                assert.ok(!err);
                assert.strictEqual(statement.getNumUpdatedRows(), 6);
                callback();
              }
            });
        }],
      done);
    });
  });
});