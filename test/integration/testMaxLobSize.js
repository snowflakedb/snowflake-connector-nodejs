const assert = require('assert');
const async = require('async');
const testUtil = require('./testUtil');
const crypto = require('crypto');
const snowflake = require('./../../lib/snowflake');
const connOption = require('./connectionOptions');
const os = require('os');
const path = require('path');

const DATABASE_NAME = connOption.valid.database;
const SCHEMA_NAME = connOption.valid.schema;

function generateRandomString(sizeInBytes) {
  const bufferSize = Math.ceil(sizeInBytes / 2);
  const buffer = crypto.randomBytes(bufferSize);
  return buffer.toString('hex').slice(0, sizeInBytes);
}

if (process.env.RUN_MANUAL_TESTS_ONLY === 'true'){
  describe.only('Max LOB test', function () {
    let connection;
    // This size cannot be tested on our env. The snowflake team should test internally.
    const MAX_LOB_SIZE = 128 * 1024 * 1024;
    const LARGE_SIZE = MAX_LOB_SIZE / 2;
    const MEDIUM_SIZE = LARGE_SIZE / 2;
    const ORIGIN_SIZE = MEDIUM_SIZE / 2;
    const SMALL_SIZE = 16;

    const tableName = 'my_lob_test';
    const createTable = `create or replace table ${tableName} (c1 varchar, c2 varchar, c3 int)`;
    const allowLobExternalScan = 'alter session set ALLOW_LARGE_LOBS_IN_EXTERNAL_SCAN = true';
    const stageName = `@${DATABASE_NAME}.${SCHEMA_NAME}.%${tableName}`;
    const copyIntoTable = `copy into ${tableName}`;
    const removeStage = `remove ${stageName}`;
    const normalInsert = `insert into ${tableName}(c1, c2, c3) values `;
    const positionalBindingInsert = `insert into ${tableName}(c1, c2, c3) values (?, ?, ?)`;
    const namedBindingInsert = `insert into ${tableName}(c1, c2, c3) values (:1, :2, :3)`;
    const selectTable = `select * FROM ${tableName}`;

    const smallSizeTableData = {
      C1: generateRandomString(SMALL_SIZE),
      C2: generateRandomString(SMALL_SIZE),
      C3: Math.ceil(Math.random() * 100000)
    };

    const originSizeTableData = {
      C1: generateRandomString(ORIGIN_SIZE),
      C2: generateRandomString(ORIGIN_SIZE),
      C3: Math.ceil(Math.random() * 100000)
    };

    const mediumSizeTableData = {
      C1: generateRandomString(MEDIUM_SIZE),
      C2: generateRandomString(ORIGIN_SIZE),
      C3: Math.ceil(Math.random() * 100000)
    };

    const largeSizeTableData = {
      C1: generateRandomString(LARGE_SIZE),
      C2: generateRandomString(ORIGIN_SIZE),
      C3: Math.ceil(Math.random() * 100000)
    };

    const maxSizeTableData = {
      C1: generateRandomString(MAX_LOB_SIZE),
      C2: generateRandomString(ORIGIN_SIZE),
      C3: Math.ceil(Math.random() * 100000)
    };

    const testCases = [
      { name: 'test - insert 16byte size data', data: smallSizeTableData },
      { name: 'test - insert 16MB size data', data: originSizeTableData },
      { name: 'test - insert 32MB size data', data: mediumSizeTableData },
      { name: 'test - insert 64MB size data', data: largeSizeTableData },
      { name: 'test - insert 128MB size data', data: maxSizeTableData }
    ];

    describe('test the increased LOB memory', function () {
      const testSizes = [SMALL_SIZE, ORIGIN_SIZE, MEDIUM_SIZE, LARGE_SIZE, MAX_LOB_SIZE];

      before(async function () {
        connection = testUtil.createConnection();
        await testUtil.connectAsync(connection);
      });

      after(async () => {
        await testUtil.destroyConnectionAsync(connection);
      });

      testSizes.forEach((size) => {
        it(`test ${size} byte size data`, function (){
          testUtil.executeCmd(connection, `select randstr(${size}, 124)`, (err) => assert.ok(!err));
        });
      });
    });

    describe('test put get max LOB size', function () {
      before(async () => {
        connection = testUtil.createConnection();
        await testUtil.connectAsync(connection);
        await testUtil.executeCmdAsync(connection, createTable);
        await testUtil.executeCmdAsync(connection, allowLobExternalScan);
      });

      after(async () => {
        await testUtil.executeCmdAsync(connection, removeStage);
        await testUtil.dropTablesIgnoringErrorsAsync(connection, [tableName]);
        await testUtil.destroyConnectionAsync(connection);
      });

      it('test - copy to stage where size > 16MB', function (done){
        const rowData = mediumSizeTableData.C1 + ',' + mediumSizeTableData.C2 + ',' + mediumSizeTableData.C3 + '\n';
        const tmpFile = testUtil.createTempFile(os.tmpdir(), testUtil.createRandomFileName(), rowData);

        let putQuery = `PUT file://${tmpFile} ${stageName}`;
        // Windows user contains a '~' in the path which causes an error
        if (process.platform === 'win32') {
          const fileName = path.basename(tmpFile);
          putQuery = `PUT file://${process.env.USERPROFILE}\\AppData\\Local\\Temp\\${fileName} ${stageName}`;
        }

        async.series([
          function (callback) {
            // Upload file
            connection.execute({
              sqlText: putQuery,
              complete: function (err) {
                if (err) {
                  callback(err);
                } else {
                  callback();
                }
              }
            });
          },
          function (callback) {
            // Copy into temp table
            connection.execute({
              sqlText: copyIntoTable,
              complete: function (err, _, rows) {
                if (err) {
                  callback(err);
                } else {
                  assert.equal(rows[0].status, 'LOADED');
                  callback();
                }
              }
            });
          }
        ], done);
      });
    });

    describe('test literal Insert', function () {
      before(async function () {
        connection = testUtil.createConnection();
        await testUtil.connectAsync(connection);
      });

      after(async () => {
        await testUtil.dropTablesIgnoringErrorsAsync(connection, [tableName]);
        await testUtil.destroyConnectionAsync(connection);
      });

      beforeEach(async () => {
        await testUtil.executeCmdAsync(connection, createTable);
      });

      testCases.forEach(({ name, data }) => {
        it(name, function (done){
          async.series([
            function (callback) {
              testUtil.executeCmd(connection, normalInsert + `('${data.C1}','${data.C2}',${data.C3})`, callback);
            },
            function (callback) {
              testUtil.executeQueryAndVerify(
                connection,
                selectTable,
                [{ ...data }],
                callback
              );
            },
          ],
          done
          );
        });
      });
    });

    describe('test named binding insert', function () {
      before(async function () {
        connection = testUtil.createConnection();
        await testUtil.connectAsync(connection);
      });

      after(async () => {
        await testUtil.dropTablesIgnoringErrorsAsync(connection, [tableName]);
        await testUtil.destroyConnectionAsync(connection);
      });

      beforeEach(async () => {
        await testUtil.executeCmdAsync(connection, createTable);
      });

      testCases.forEach(({ name, data }) => {
        it(name, function (done){
          async.series([
            function (callback) {
              testUtil.executeCmd(connection, namedBindingInsert, callback, Object.values(data));
            },
            function (callback) {
              testUtil.executeQueryAndVerify(
                connection,
                selectTable,
                [{ ...data }],
                callback
              );
            },
          ],
          done
          );
        });
      });
    });

    describe('test positional binding insert', function () {
      before(async function () {
        connection = testUtil.createConnection();
        await testUtil.connectAsync(connection);
      });

      after(async () => {
        await testUtil.dropTablesIgnoringErrorsAsync(connection, [tableName]);
        await testUtil.destroyConnectionAsync(connection);
      });

      beforeEach(async () => {
        await testUtil.executeCmdAsync(connection, createTable);
      });

      testCases.forEach(({ name, data }) => {
        it(name, function (done){
          async.series([
            function (callback) {
              testUtil.executeCmd(connection, positionalBindingInsert, callback, Object.values(data));
            },
            function (callback) {
              testUtil.executeQueryAndVerify(
                connection,
                selectTable,
                [{ ...data }],
                callback
              );
            },
          ],
          done
          );
        });
      });
    });

    describe('test array bind parameter', function () {
      before(async function () {
        connection = snowflake.createConnection({
          ...connOption.valid,
          arrayBindingThreshold: 1,
        });
        await testUtil.connectAsync(connection);
      });

      after(async () => {
        await testUtil.dropTablesIgnoringErrorsAsync(connection, [tableName]);
        await testUtil.destroyConnectionAsync(connection);
      });

      beforeEach(async () => {
        await testUtil.executeCmdAsync(connection, createTable);
      });

      testCases.forEach(({ name, data }) => {
        it(name, function (done){
          async.series([
            function (callback) {
              testUtil.executeCmd(connection, positionalBindingInsert, callback, Object.values(data));
            },
            function (callback) {
              testUtil.executeQueryAndVerify(
                connection,
                selectTable,
                [{ ...data }],
                callback
              );
            },
          ],
          done
          );
        });
      });
    });

    describe('test increased max LOB size parameter switch', function () {
      before(async () => {
        connection = testUtil.createConnection();
        await testUtil.connectAsync(connection);
        await testUtil.executeCmdAsync(connection, 'alter session set FEATURE_INCREASED_MAX_LOB_SIZE_IN_MEMORY=\'ENABLED\'');
      });

      after(async () => {
        await testUtil.executeCmdAsync(connection, 'alter session unset FEATURE_INCREASED_MAX_LOB_SIZE_IN_MEMORY');
        await testUtil.executeCmdAsync(connection, 'alter session unset ENABLE_LARGE_VARCHAR_AND_BINARY_IN_RESULT');
        await testUtil.destroyConnectionAsync(connection);
      });

      it('switching parameters should affect response when selecting 20MB string', async function () {
        await async.series([
          function (callback) {
            testUtil.executeCmd(connection, 'alter session set ENABLE_LARGE_VARCHAR_AND_BINARY_IN_RESULT=false', callback);
          },
          function (callback) {
            connection.execute({
              sqlText: 'select randstr(20000000, random()) as large_str',
              complete: function (err) {
                assert.match(err.message, /^.*exceeds supported length.*$/);
                callback();
              }
            });
          },
          function (callback) {
            testUtil.executeCmd(connection, 'alter session set ENABLE_LARGE_VARCHAR_AND_BINARY_IN_RESULT=true', callback);
          },
          function (callback) {
            connection.execute({
              sqlText: 'select randstr(20000000, random()) as large_str',
              complete: function (err) {
                assert.equal(err, null);
                callback();
              }
            });
          },
        ]);
      });
    });
  });
}

