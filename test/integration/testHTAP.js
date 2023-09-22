/*
 * Copyright (c) 2023 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const async = require('async');
const connOption = require('./connectionOptions').valid;
const testUtil = require('./testUtil');

// Only the AWS servers support the hybrid table in the GitHub action.
if (process.env.CLOUD_PROVIDER === 'AWS') {
  describe('Query Context Cache test', function () {
    let connection;
    
    before(async () => {
      connection = testUtil.createConnection(connOption);
      await testUtil.connectAsync(connection);
    });

    after(async () => {
      await testUtil.destroyConnectionAsync(connection);
    });

    const querySet = [
      {
        sqlTexts: [
          'create or replace database db1',
          'create or replace hybrid table t1 (a int primary key, b int)',
          'insert into t1 values (1, 2), (2, 3), (3, 4)'
        ],
        QccSize: 2,
      },
      {
        sqlTexts: [
          'create or replace database db2',
          'create or replace hybrid table t2 (a int primary key, b int)',
          'insert into t2 values (1, 2), (2, 3), (3, 4)'
        ],
        QccSize: 3,
      },
      {
        sqlTexts: [
          'create or replace database db3',
          'create or replace hybrid table t3 (a int primary key, b int)',
          'insert into t3 values (1, 2), (2, 3), (3, 4)'
        ],
        QccSize: 4,
      },
      {
        sqlTexts: [
          'select * from db1.public.t1 x, db2.public.t2 y, db3.public.t3 z where x.a = y.a and y.a = z.a;',
          'select * from db1.public.t1 x, db2.public.t2 y where x.a = y.a;',
          'select * from db2.public.t2 y, db3.public.t3 z where y.a = z.a;'
        ],
        QccSize: 4,
      },
    ];

    function createQueryTest() {
      const testingSet = [];
      let testingfunction;
      for (let i = 0; i < querySet.length; i++) {
        const { sqlTexts, QccSize } = querySet[i];
        for (let k = 0; k < sqlTexts.length; k++){
          if (k !== sqlTexts.length - 1){
            testingfunction = function (callback) {
              connection.execute({
                sqlText: sqlTexts[k],
                complete: function (err) {
                  assert.ok(!err, 'There should be no error!');
                  callback();
                }
              });
            };
          } else {
            testingfunction = function (callback) {
              connection.execute({
                sqlText: sqlTexts[k],
                complete: function (err, stmt) {
                  assert.ok(!err, 'There should be no error!');
                  assert.strictEqual(stmt.getQueryContextCacheSize(), QccSize);
                  assert.strictEqual(stmt.getQueryContextDTOSize(), QccSize);
                  callback(); 
                }
              });
            };
          }
          testingSet.push(testingfunction);
        }
      }
      return testingSet;
    }
  
    it('test Query Context Cache', function (done) {
      async.series(createQueryTest(), done);
    });
  });
}