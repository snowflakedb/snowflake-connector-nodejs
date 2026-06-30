const async = require('async');
const testUtil = require('./testUtil');
const { startProxyServer } = require('../proxy_server');

describe('Execute proxy test', function () {
  let connection;
  let proxyServer;
  const createNodeTSQL = 'create or replace table NodeT(colA number, colB varchar)';
  const selectAllSQL = 'select * from NodeT';
  const insertNodeTSQL = "insert into NodeT values(1, 'a')";
  const updateNodeTSQL = "update NodeT set COLA = 2, COLB = 'b' where COLA = 1";
  const dropNodeTSQL = 'drop table if exists NodeT';

  before(async function () {
    proxyServer = await startProxyServer();
    connection = testUtil.createConnection({
      proxyHost: '127.0.0.1',
      proxyPort: proxyServer.port,
    });
    await testUtil.connectAsync(connection);
  });

  after(async function () {
    await testUtil.executeCmdAsync(connection, dropNodeTSQL);
    await testUtil.destroyConnectionAsync(connection);
    await proxyServer.shutdown();
  });

  it('testSimpleInsert', function (done) {
    async.series(
      [
        function (callback) {
          testUtil.executeCmd(connection, createNodeTSQL, callback);
        },
        function (callback) {
          const insertCount = 5;
          const insertValues = function (i) {
            if (i < insertCount) {
              testUtil.executeCmd(connection, insertNodeTSQL, function () {
                insertValues(i + 1);
              });
            } else {
              callback();
            }
          };
          insertValues(0);
        },
        function (callback) {
          testUtil.executeQueryAndVerify(
            connection,
            selectAllSQL,
            [
              { COLA: 1, COLB: 'a' },
              { COLA: 1, COLB: 'a' },
              { COLA: 1, COLB: 'a' },
              { COLA: 1, COLB: 'a' },
              { COLA: 1, COLB: 'a' },
            ],
            callback,
          );
        },
      ],
      done,
    );
  });

  it('testSimpleUpdate', function (done) {
    async.series(
      [
        function (callback) {
          testUtil.executeCmd(connection, createNodeTSQL, callback);
        },
        function (callback) {
          testUtil.executeCmd(connection, insertNodeTSQL, callback);
        },
        function (callback) {
          testUtil.executeCmd(connection, updateNodeTSQL, callback);
        },
        function (callback) {
          testUtil.executeQueryAndVerify(
            connection,
            selectAllSQL,
            [{ COLA: 2, COLB: 'b' }],
            callback,
          );
        },
      ],
      done,
    );
  });

  it('testDDLDMLResultSet', function (done) {
    async.series(
      [
        function (callback) {
          testUtil.executeQueryAndVerify(
            connection,
            createNodeTSQL,
            [{ status: 'Table NODET successfully created.' }],
            callback,
          );
        },
        function (callback) {
          testUtil.executeQueryAndVerify(
            connection,
            insertNodeTSQL,
            [{ 'number of rows inserted': 1 }],
            callback,
          );
        },
      ],
      done,
    );
  });
});
