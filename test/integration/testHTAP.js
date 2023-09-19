const assert = require('assert');
const async = require('async');
const connOption = require('./connectionOptions').valid;
const testUtil = require('./testUtil');

describe('Query Context Cache test', function () {
  let connection;
  beforeEach(() => {
    connection = testUtil.createConnection(connOption);
  });
  const querySet = [
    {
      sqlTexts:[
        'create or replace database db1',
        'create or replace hybrid table t1 (a int primary key, b int)',
        'insert into t1 values (1, 2), (2, 3), (3, 4)'
      ],
      QccSize:2,
    },
    {
      sqlTexts:[
        'create or replace database db2',
        'create or replace hybrid table t2 (a int primary key, b int)',
        'insert into t2 values (1, 2), (2, 3), (3, 4)'
      ],
      QccSize:3,
    },
    {
      sqlTexts:[
        'create or replace database db3',
        'create or replace hybrid table t3 (a int primary key, b int)',
        'insert into t3 values (1, 2), (2, 3), (3, 4)'
      ],
      QccSize:4,
    },
    {
      sqlTexts:[
        'select * from db1.public.t1 x, db2.public.t2 y, db3.public.t3 z where x.a = y.a and y.a = z.a;',
        'select * from db1.public.t1 x, db2.public.t2 y where x.a = y.a;',
        'select * from db2.public.t2 y, db3.public.t3 z where y.a = z.a;'
      ],
      QccSize:4,
    },
  ];

  function createQueryTest () {
    const testingSet = [];
    for(let i = 0; i < querySet.length; i++) {
      const testingFunction = function(callback) {
        const {sqlTexts,QccSize} = querySet[i];
        connection.execute({
          sqlText: sqlTexts[0],
          complete: function (err) {
            if (err) {
              callback(err);
            }
          }
        });
        connection.execute({
          sqlText: sqlTexts[1],
          complete: function (err) {
            if (err) {
              callback(err);
            }
          }
        });
        connection.execute({
          sqlText: sqlTexts[2],
          complete: function (err, stmt) {
            assert.ok(!err,'There should be no error!');
            assert.strictEqual(stmt.getQueryContextCacheSize(), QccSize);
            assert.strictEqual(stmt.getQueryContextDTOSize(),QccSize);
            callback(); 
          }
        });
      };
      testingSet.push(testingFunction);
    }
    return testingSet;
  }

  it('test Query Context Cache', function (done) {
    let queryTests = createQueryTest();
    async.series(
      [
        function (callback) {
          connection.connect(function (err, conn) {
            assert.ok(!err, 'there should be no error');
            assert.strictEqual(conn, connection,
              'the connect() callback should be invoked with the statement');

            callback();
          });
        },
        ...queryTests
      ],
      function () {
        done();
      });
  });

});
