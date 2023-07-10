/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

const async = require('async');
const testUtil = require('./testUtil');
const os = require('os');

describe('Execute proxy test', function () {
  const platform = os.platform();
  if (platform === 'linux') {
    let connection;
    const createNodeTSQL = 'create or replace table NodeT(colA number, colB varchar)';
    const selectAllSQL = 'select * from NodeT';
    const insertNodeTSQL = 'insert into NodeT values(1, \'a\')';
    const updateNodeTSQL = 'update NodeT set COLA = 2, COLB = \'b\' where COLA = 1';
    const dropNodeTSQL = 'drop table if exists NodeT';

    before(function (done) {
      connection = testUtil.createProxyConnection();
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
          testUtil.executeCmd(connection, dropNodeTSQL, callback);
        },
        function (callback) {
          testUtil.destroyConnection(connection, callback);
        }],
      done
      );
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
                testUtil.executeCmd(connection,
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
            testUtil.executeQueryAndVerify(
              connection,
              selectAllSQL,
              [{'COLA': 1, 'COLB': 'a'},
                {'COLA': 1, 'COLB': 'a'},
                {'COLA': 1, 'COLB': 'a'},
                {'COLA': 1, 'COLB': 'a'},
                {'COLA': 1, 'COLB': 'a'}],
              callback
            );
          }],
        done
      );
    });

    it('testSimpleUpdate', function (done) {
      async.series([
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
            [{'COLA': 2, 'COLB': 'b'}],
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
            testUtil.executeQueryAndVerify(
              connection,
              createNodeTSQL,
              [{'status': 'Table NODET successfully created.'}],
              callback
            );
          },
          function (callback) {
            testUtil.executeQueryAndVerify(
              connection,
              insertNodeTSQL,
              [{'number of rows inserted': 1}],
              callback
            );
          }],
        done
      );
    });
  }
});

