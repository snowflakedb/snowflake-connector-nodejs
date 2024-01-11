const assert = require('assert');
const async = require('async');
const testUtil = require('./testUtil');
const crypto = require('crypto');
const snowflake = require('./../../lib/snowflake');
const connOption = require('./connectionOptions');

function generateRandomString(sizeInBytes) {
  const bufferSize = Math.ceil(sizeInBytes / 2);
  const buffer = crypto.randomBytes(bufferSize);
  return buffer.toString('hex').slice(0, sizeInBytes);
}

describe.skip('Max LOB test', function () {
  let connection;
  const SMALL_SIZE = 16;
  const ORIGIN_SIZE = 16 * 1024 * 1024; 
  const MEDIEUM_SIZE = ORIGIN_SIZE * 2;
  const LARGE_SIZE = MEDIEUM_SIZE * 2;
  const MAX_LOB_SIZE = LARGE_SIZE * 2;

  const singleTest = 'select randstr(50000000, 124);';
  const tableName = 'my_lob_test';
  const createTable = `create or replace table ${tableName} (c1 varchar, c2 varchar, c3 int)`;
  const normalInsert = `insert into ${tableName}(c1, c2, c3) values `;
  const bindInsert = `insert into ${tableName}(c1, c2, c3) values (?, ?, ?)`;
  const positionalInsert = `insert into ${tableName}(c1, c2, c3) values (:2, :1, :3)`;
  const selectTable = `select * FROM ${tableName}`;

  const testCases = [
    {
      name: 'insert a small data',
      data: {
        C1: generateRandomString(SMALL_SIZE), 
        C2: generateRandomString(SMALL_SIZE), 
        C3: Math.ceil(Math.random() * 100000)
      },
      
    },
    {
      name: 'insert a origin size data',
      data: {
        C1: generateRandomString(ORIGIN_SIZE), 
        C2: generateRandomString(ORIGIN_SIZE), 
        C3: Math.ceil(Math.random() * 100000)
      },
    },
    {
      name: 'insert a origin size data',
      data: {
        C1: generateRandomString(MEDIEUM_SIZE), 
        C2: generateRandomString(ORIGIN_SIZE), 
        C3: Math.ceil(Math.random() * 100000)
      },
    },
    {
      name: 'insert a origin size data',
      data: {
        C1: generateRandomString(LARGE_SIZE), 
        C2: generateRandomString(ORIGIN_SIZE), 
        C3: Math.ceil(Math.random() * 100000)
      },
    },
    {
      name: 'insert a origin size data',
      data: {
        C1: generateRandomString(MAX_LOB_SIZE), 
        C2: generateRandomString(ORIGIN_SIZE), 
        C3: Math.ceil(Math.random() * 100000)
      },
    },
  ];

  describe('Literal Insert', function () {
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

    it('test increased memoery',  function () {
      connection.execute({
        sqlText: singleTest,
        complete: function (err) {
          assert.ok(!err);
        },
      });
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

  describe('test bind insert', function () {
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
            testUtil.executeCmd(connection, bindInsert, callback, Object.values(data));
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

  describe('test bind insert', function () {
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
            testUtil.executeCmd(connection, bindInsert, callback, Object.values(data));
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

  describe('test positional insert', function () {
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
            testUtil.executeCmd(connection, positionalInsert, callback, Object.values(data));
          },
          function (callback) {
            testUtil.executeQueryAndVerify(
              connection,
              selectTable,
              [{ ...data, C1: data.C2, C2: data.C1 }],
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
            testUtil.executeCmd(connection, bindInsert, callback, Object.values(data));
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
});
