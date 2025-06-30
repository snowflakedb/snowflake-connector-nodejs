const async = require('async');
const testUtil = require('./testUtil');
const { randomizeName } = require('./testUtil');

describe('Execute test with Pool', function () {
  let connectionPool = null;
  const nodeT = randomizeName('nodeT');
  const createNodeTSQL = `create or replace table ${nodeT}(colA number, colB varchar)`;
  const selectAllSQL = `select * from ${nodeT}`;
  const insertNodeTSQL = `insert into ${nodeT} values(1, 'a')`;
  const updateNodeTSQL = `update ${nodeT} set COLA = 2, COLB = 'b' where COLA = 1`;
  const dropNodeTSQL = `drop table if exists ${nodeT}`;

  before(function (done) {
    connectionPool = testUtil.createConnectionPool();
    done();
  });

  after(function (done) {
    testUtil.executeCmdUsePool(connectionPool, dropNodeTSQL, done);
  });

  it('testSimpleInsert', function (done) {
    async.series(
      [
        function (callback) {
          testUtil.executeCmdUsePool(connectionPool, createNodeTSQL, callback);
        },
        function (callback) {
          const insertCount = 5;
          const insertValues = function (i) {
            if (i < insertCount) {
              testUtil.executeCmdUsePool(connectionPool,
                insertNodeTSQL,
                function () {
                  insertValues(i + 1);
                });
            } else {
              callback();
            }
          };
          insertValues(0);
        },
        function (callback) {
          testUtil.executeQueryAndVerifyUsePool(
            connectionPool,
            selectAllSQL,
            [{ 'COLA': 1, 'COLB': 'a' },
              { 'COLA': 1, 'COLB': 'a' },
              { 'COLA': 1, 'COLB': 'a' },
              { 'COLA': 1, 'COLB': 'a' },
              { 'COLA': 1, 'COLB': 'a' }],
            callback
          );
        }
      ],
      done
    );
  });

  it('testSimpleUpdate', function (done) {
    async.series([
      function (callback) {
        testUtil.executeCmdUsePool(connectionPool, createNodeTSQL, callback);
      },
      function (callback) {
        testUtil.executeCmdUsePool(connectionPool, insertNodeTSQL, callback);
      },
      function (callback) {
        testUtil.executeCmdUsePool(connectionPool, updateNodeTSQL, callback);
      },
      function (callback) {
        testUtil.executeQueryAndVerifyUsePool(
          connectionPool,
          selectAllSQL,
          [{ 'COLA': 2, 'COLB': 'b' }],
          callback
        );
      }],
    done
    );
  });

  it('testDDLDMLResultSet', function (done) {
    async.series(
      [
        function (callback) {
          testUtil.executeQueryAndVerifyUsePool(
            connectionPool,
            createNodeTSQL,
            [{ 'status': `Table ${nodeT.toUpperCase()} successfully created.` }],
            callback
          );
        },
        function (callback) {
          testUtil.executeQueryAndVerifyUsePool(
            connectionPool,
            insertNodeTSQL,
            [{ 'number of rows inserted': 1 }],
            callback
          );
        }],
      done
    );
  });
});

describe('Execute test use Pool for multiple connections', function () {
  let connectionPool = null;
  const nodeA = randomizeName('NodeA');
  const nodeB = randomizeName('NodeB');
  const createNodeASQL = `create or replace table ${nodeA} (colA number, colB varchar);`;
  const createNodeBSQL = `create or replace table ${nodeB}(colA number, colB varchar);`;
  const selectAllSQLFromNodeA = `select * from ${nodeA};`;
  const selectAllSQLFromNodeB = `select * from ${nodeB};`;
  const insertNodeASQL = `insert into ${nodeA} values(1, 'a');`;
  const insertNodeBSQL = `insert into ${nodeB} values(1, 'b');`;
  const dropNodeASQL = `drop table if exists ${nodeA};`;
  const dropNodeBSQL = `drop table if exists ${nodeB};`;

  before(function (done) {
    connectionPool = testUtil.createConnectionPool();
    async.series(
      [
        function (callback) {
          testUtil.executeCmdUsePool(connectionPool, createNodeASQL, callback);
        },
        function (callback) {
          testUtil.executeCmdUsePool(connectionPool, createNodeBSQL, callback);
        },
        function (callback) {
          testUtil.executeCmdUsePool(connectionPool, insertNodeASQL, callback);
        },
        function (callback) {
          testUtil.executeCmdUsePool(connectionPool, insertNodeBSQL, callback);
        }
      ],
      done
    );
  });

  after(function (done) {
    async.series(
      [
        function (callback) {
          testUtil.executeCmdUsePool(connectionPool, dropNodeASQL, callback);
        },
        function (callback) {
          testUtil.executeCmdUsePool(connectionPool, dropNodeBSQL, callback);
        }
      ],
      done
    );
  });

  it('testSimpleInsert', function (done) {    
    async.parallel(
      [
        function (callback) {
          testUtil.executeQueryAndVerifyUsePool(
            connectionPool,
            selectAllSQLFromNodeA,
            [{ 'COLA': 1, 'COLB': 'a' }],
            callback
          );
        },
        function (callback) {
          testUtil.executeQueryAndVerifyUsePool(
            connectionPool,
            selectAllSQLFromNodeB,
            [{ 'COLA': 1, 'COLB': 'b' }],
            callback
          );
        }
      ],
      done
    );
  });
});
