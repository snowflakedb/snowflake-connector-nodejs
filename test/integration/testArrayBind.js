const snowflake = require('./../../lib/snowflake');
const async = require('async');
const assert = require('assert');
const testUtil = require('./testUtil');
const connOption = require('./connectionOptions');
const Logger = require('../../lib/logger');

describe('Test Array Bind', function () {
  this.timeout(300000);
  let connection;
  const createABTable = 'create or replace table testAB(colA string, colB number, colC date, colD time, colE TIMESTAMP_NTZ, colF TIMESTAMP_TZ, bi binary(5), bool boolean)';
  const insertAB = 'insert into testAB values(?, ?, ?, ?, ?, ?, ?, ?)';
  const selectAB = 'select * from testAB where colB = 1';
  const createNABTable = 'create or replace table testNAB(colA string, colB number, colC date, colD time, colE TIMESTAMP_NTZ, colF TIMESTAMP_TZ, bi binary(5), bool boolean)';
  const insertNAB = 'insert into testNAB values(?, ?, ?, ?, ?, ?, ?, ?)';
  const selectNAB = 'select * from testNAB where colB = 1';
  const createNullTable = 'create or replace table testNullTB(colA string, colB number, colC date, colD time, colE TIMESTAMP_NTZ, colF TIMESTAMP_TZ, bi binary(5), bool boolean)';
  const insertNull = 'insert into testNullTB values(?, ?, ?, ?, ?, ?, ?, ?)';
  const selectNull = 'select * from testNullTB where colB = 1';
  const binaryData = (0xffff00).toString(16);

  const usedTableNames = [
    'testAB', 'testNAB', 'testNullTB',
  ];

  before(function (done) {

    connection = snowflake.createConnection({
      ...connOption.valid,
      arrayBindingThreshold: 3,
    });
    testUtil.connect(connection, err => {
      done(err);
    });
  });

  afterEach(async () => {
    await testUtil.dropTablesIgnoringErrorsAsync(connection, usedTableNames);
  });

  after(async () => {
    await testUtil.destroyConnectionAsync(connection);
  });

  it('testArrayBind', function (done) {
    let NABData;
    async.series(
      [
        function (callback) {
          connection.execute({
            sqlText: createABTable,
            complete: function (err) {
              testUtil.checkError(err);
              callback();
            }
          });
        },
        function (callback) {
          const arrBind = [];
          const count = 100;
          for (let i = 0; i < count; i++) {
            arrBind.push(['string' + i, i, '2020-05-11', '12:35:41.3333333', new Date('2022-04-01 23:59:59'), new Date('2022-07-08 12:05:30.9999999'), binaryData, true]);
          }

          const insertABStmt = connection.execute({
            sqlText: insertAB,
            binds: arrBind,
            complete: function (err, stmt) {
              testUtil.checkError(err);
              assert.strictEqual(stmt.getNumUpdatedRows(), count);
              assert.strictEqual(insertABStmt.getSqlText(), insertAB);
              assert.strictEqual(insertABStmt.getNumUpdatedRows(), count);
              callback();
            }
          });
        },
        function (callback) {
          connection.execute({
            sqlText: createNABTable,
            complete: function (err) {
              testUtil.checkError(err);
              callback();
            }
          });
        },
        function (callback) {
          const arrBind = [];
          const count = 2;
          for (let i = 0; i < count; i++) {
            arrBind.push(['string' + i, i, '2020-05-11', '12:35:41.3333333', new Date('2022-04-01 23:59:59'), new Date('2022-07-08 12:05:30.9999999'), binaryData, true]);
          }
          connection.execute({
            sqlText: insertNAB,
            binds: arrBind,
            complete: function (err, stmt) {
              testUtil.checkError(err);
              assert.strictEqual(stmt.getNumUpdatedRows(), count);
              callback();
            }
          });
        },
        function (callback) {
          connection.execute({
            sqlText: selectNAB,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              NABData = rows[0];
              callback();
            }
          });
        },
        function (callback) {
          connection.execute({
            sqlText: selectAB,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const ABData = rows[0];

              const ABDate = new Date(ABData['COLC']);
              const ABDataD = new Date(ABData['COLD']).getTime();
              const ABDataE = new Date(ABData['COLE']).getTime();
              const ABDataF = new Date(ABData['COLF']).getTime();
              const NABDate = new Date(NABData['COLC']);
              const NABDataD = new Date(NABData['COLD']).getTime();
              const NABDataE = new Date(NABData['COLE']).getTime();
              const NABDataF = new Date(NABData['COLF']).getTime();

              assert.equal(ABData['COLA'], NABData['COLA']);
              assert.equal(ABData['COLB'], NABData['COLB']);
              assert.equal(ABDate.toString(), NABDate.toString());
              assert.equal(ABDataD.toString(), NABDataD.toString());
              assert.equal(ABDataE.toString(), NABDataE.toString());
              assert.equal(ABDataF.toString(), NABDataF.toString());

              assert.equal(ABData['BOOL'], true);
              assert.equal(Buffer.from(ABData['BI']).toString('hex'), binaryData);
              callback();
            }
          });
        },
      ],
      done
    );
  });

  it('testArrayBindWillNull', function (done) {
    let NABData;
    async.series(
      [
        function (callback) {
          connection.execute({
            sqlText: createNullTable,
            complete: function (err) {
              callback(err);
            }
          });
        },
        function (callback) {
          const arrBind = [];
          const count = 100;
          for (let i = 0; i < count; i++) {
            arrBind.push([null, i, '2020-05-11', '12:35:41.3333333', '2022-04-01 23:59:59', '2022-07-08 12:05:30.9999999', binaryData, true]);
          }
          
          connection.execute({
            sqlText: insertNull,
            binds: arrBind,
            complete: function (err, stmt) {
              if (err) {
                callback(err);
              } else if (stmt.getNumUpdatedRows() !== count) {
                callback(new Error(`Expected number of inserted rows to be ${count} but was ${stmt.getNumUpdatedRows()}`));
              } else {
                callback();
              }
            }
          });
        },
        function (callback) {
          connection.execute({
            sqlText: createNABTable,
            complete: function (err) {
              callback(err);
            }
          });
        },
        function (callback) {
          const arrBind = [];
          const count = 2;
          for (let i = 0; i < count; i++) {
            arrBind.push(['string' + i, i, '2020-05-11', '12:35:41.3333333', '2022-04-01 23:59:59', '2022-07-08 12:05:30.9999999', binaryData, true]);
          }
          connection.execute({
            sqlText: insertNAB,
            binds: arrBind,
            complete: function (err, stmt) {
              if (err) {
                callback(err);
              } else if (stmt.getNumUpdatedRows() !== count) {
                callback(new Error(`Expected number of inserted rows to be ${count} but was ${stmt.getNumUpdatedRows()}`));
              } else {
                callback();
              }
            }
          });
        },
        function (callback) {
          connection.execute({
            sqlText: selectNAB,
            complete: function (err, stmt, rows) {
              if (err) {
                callback(err);
              } else {
                NABData = rows[0];
                callback();
              }
            }
          });
        },
        function (callback) {
          connection.execute({
            sqlText: selectNull,
            complete: function (err, stmt, rows) {
              if (err) {
                callback(err);
              } else {
                try {
                  const ABData = rows[0];

                  const ABDate = new Date(ABData['COLC']);
                  const ABDataD = new Date(ABData['COLD']).getTime();
                  const ABDataE = new Date(ABData['COLE']).getTime();
                  const ABDataF = new Date(ABData['COLF']).getTime();
                  const NABDate = new Date(NABData['COLC']);
                  const NABDataD = new Date(NABData['COLD']).getTime();
                  const NABDataE = new Date(NABData['COLE']).getTime();
                  const NABDataF = new Date(NABData['COLF']).getTime();

                  assert.equal(ABData['COLA'], '');
                  assert.equal(ABData['COLB'], NABData['COLB']);
                  assert.equal(ABDate.toString(), NABDate.toString());
                  assert.equal(ABDataD.toString(), NABDataD.toString());
                  assert.equal(ABDataE.toString(), NABDataE.toString());
                  assert.equal(ABDataF.toString(), NABDataF.toString());
                  callback();
                } catch (e) {
                  callback(e);
                }
              }
            }
          });
        },
      ],
      done
    );
  });
  
  it('testBindWithJson', function (done) {
    async.series(
      [
        function (callback) {
          const createSql = 'create or replace table testBindJson(colA varchar(30), colB varchar(30))';
          testUtil.executeCmd(connection, createSql, callback);
        },
        function (callback) {
          const arrBind = [];
          const count = 100;
          for (let i = 0; i < count; i++) {
            arrBind.push(['some-data-for-stuff1', 'some-data-for-stuff2']);
          }
          const insertSql = 'insert into testBindJson(cola,colb) select value:stuff1, value:stuff2 from table(flatten(parse_json(?)))';
          connection.execute({
            sqlText: insertSql,
            binds: [JSON.stringify(arrBind)],
            complete: function (err, stmt) {
              if (err) {
                callback(err);
              } else {
                assert.strictEqual(stmt.getNumUpdatedRows(), count);
                callback();
              }
            }
          });
        },
      ],
      done
    );
  });
  it('testBindWithLargeArray', function (done) {
    async.series(
      [
        function (callback) {
          const createSql = 'create or replace table testBindLargeArray(colA varchar(30))';
          testUtil.executeCmd(connection, createSql, callback);
        },
        function (callback) {
          const arrBind = [];
          const count = 100;
          for (let i = 0; i < count; i++) {
            arrBind.push(['some-data-for-stuff1']);
          }
          const insertSql = 'insert into testBindLargeArray(colA) values (?)';
          connection.execute({
            sqlText: insertSql,
            binds: arrBind,
            complete: function (err, stmt) {
              if (err) {
                callback(err);
              } else {
                assert.strictEqual(stmt.getNumUpdatedRows(), count);
                callback();
              }
            }
          });
        },
      ],
      done
    );
  });
  it('testBindWithArray', function (done) {
    async.series(
      [
        function (callback) {
          const createSql = 'create or replace table test101 (id INT, type VARCHAR(40), data VARIANT, createdDateTime TIMESTAMP_TZ(0), action VARCHAR(256))';
          testUtil.executeCmd(connection, createSql, callback);
        },
        function (callback) {
          const dataset = [
            [
              '5489',
              'SAMPLE',
              '{"user":{"SSS":"KKKK003","email":"THE"}',
              '2018-11-02T04:14:56.000000Z',
              null
            ],
            [
              '5490',
              'SAMPLE',
              '{"user":{"SSS":"LLL108","email":"Jenn"}',
              '2018-11-02T04:14:56.000000Z',
              null
            ],
            [
              '5491',
              'SAMPLE',
              '{"user":{"SSS":"LLL108","email":"Jennif"}',
              '2018-11-02T04:14:56.000000Z',
              null
            ],
            [
              '5492',
              'SAMPLE',
              '{"user":{"SSS":"LLL108","email":"Je"}',
              '2018-11-02T04:14:56.000000Z',
              null
            ],
            [
              '5493',
              'SAMPLE',
              '{"user":{"SSS":"LLL108","email":"Jenn"}',
              '2018-11-02T04:14:56.000000Z',
              null
            ],
            [
              '5494',
              'SAMPLE',
              '{"user":{"SSS":"LLL108","email":"Jennifer@xxx.com"}',
              '2018-11-02T04:14:56.000000Z',
              null
            ]
          ];
          
          const flatValue = [];
          dataset.forEach(element => {
            element.forEach(value => {
              flatValue.push(value); 
            }); 
          });
          const insertTable101 = 'insert into test101 (id,type,data,createdDateTime,action) select COLUMN1,COLUMN2,TRY_PARSE_JSON(COLUMN3),COLUMN4,COLUMN5 from values  (?,?,?,?,?),(?,?,?,?,?),(?,?,?,?,?),(?,?,?,?,?),(?,?,?,?,?),(?,?,?,?,?)';
          connection.execute({
            sqlText: insertTable101,
            binds: flatValue,
            fetchAsString: ['Number', 'Date', 'JSON'],
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
          const selectSql = 'select * from test101 where ID = 5489';
          connection.execute({
            sqlText: selectSql,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const result = rows[0];
              assert.equal(result['TYPE'], 'SAMPLE');
              callback();
            }
          });
        },
      ],
      done
    );
  });
});

describe('Test Array Bind - full path', function () {
  const DATABASE_NAME = connOption.valid.database;
  const SCHEMA_NAME = connOption.valid.schema;

  this.timeout(600000);
  this.retries(3); // this test suit are considered as flaky

  let connection;
  const fullTableName = `${DATABASE_NAME}.${SCHEMA_NAME}.testAB`;
  const createABTable = `create or replace table ${fullTableName}(colA string, colB number, colC date, colD time, colE TIMESTAMP_NTZ, colF TIMESTAMP_TZ)`;
  const insertAB = `insert into ${fullTableName} values(?, ?, ?, ?, ?, ?)`;
  
  before(function (done) {
    connection = snowflake.createConnection({
      ...connOption.valid,
      // Set schema and database to null to ensure that full path to table is passed in commands
      schema: undefined,
      database: undefined,
      arrayBindingThreshold: 3
    });
    testUtil.connect(connection, function (err) {
      if (err) {
        done(err);
      } else {
        connection.execute({
          sqlText: createABTable,
          complete: function (err) {
            done(err);
          }
        });
      }
    });
  });

  it('Full path array bind', function (done) {
    const arrBind = [];
    const count = 100;
    for (let i = 0; i < count; i++) {
      arrBind.push([null, i, '2020-05-11', '12:35:41.3333333', '2022-04-01 23:59:59', '2022-07-08 12:05:30.9999999']);
    }
    
    connection.execute({
      sqlText: insertAB,
      binds: arrBind,
      complete: function (err, stmt) {
        testUtil.checkError(err);
        assert.strictEqual(stmt.getNumUpdatedRows(), count);
        done();
      }
    });
  });

  after(async () => {
    await testUtil.dropTablesIgnoringErrorsAsync(connection, [fullTableName]);
    await testUtil.destroyConnectionAsync(connection);
  });
});

describe('Test Array Bind Force Error on Upload file', function () {
  this.timeout(300000);
  let connection;
  const createABTable = 'create or replace table testAB(colA string, colB number, colC date, colD time, colE TIMESTAMP_NTZ, colF TIMESTAMP_TZ)';
  const insertAB = 'insert into testAB values(?, ?, ?, ?, ?, ?)';
  const selectAB = 'select * from testAB where colB = 1';
  const createNABTable = 'create or replace table testNAB(colA string, colB number, colC date, colD time, colE TIMESTAMP_NTZ, colF TIMESTAMP_TZ)';
  const insertNAB = 'insert into testNAB values(?, ?, ?, ?, ?, ?)';
  const selectNAB = 'select * from testNAB where colB = 1';

  const usedTableNames = ['testAB', 'testNAB'];

  before(function (done) {
    connection = snowflake.createConnection({
      ...connOption.valid,
      arrayBindingThreshold: 3,
      forceStageBindError: 1,
    });
    testUtil.connect(connection, function (err) {
      done(err);
    });
  });

  afterEach(async () => {
  });

  after(async () => {
    await testUtil.dropTablesIgnoringErrorsAsync(connection, usedTableNames);
    await testUtil.destroyConnectionAsync(connection);
  });

  it('testArrayBind force upload file error', function (done) {
    let NABData;
    async.series(
      [
        function (callback) {
          connection.execute({
            sqlText: createABTable,
            complete: function (err) {
              testUtil.checkError(err);
              callback();
            }
          });
        },
        function (callback) {
          const arrBind = [];
          const count = 100;
          for (let i = 0; i < count; i++) {
            arrBind.push(['string' + i, i, '2020-05-11', '12:35:41.3333333', '2022-04-01 23:59:59', '2022-07-08 12:05:30.9999999']);
          }

          const insertABStmt = connection.execute({
            sqlText: insertAB,
            binds: arrBind,
            complete: function (err, stmt) {
              testUtil.checkError(err);
              assert.strictEqual(stmt.getNumUpdatedRows(), count);
              assert.strictEqual(insertABStmt.getSqlText(), insertAB);
              assert.strictEqual(insertABStmt.getNumUpdatedRows(), count);
              callback();
            }
          });
        },
        function (callback) {
          connection.execute({
            sqlText: createNABTable,
            complete: function (err) {
              testUtil.checkError(err);
              callback();
            }
          });
        },
        function (callback) {
          const arrBind = [];
          const count = 2;
          for (let i = 0; i < count; i++) {
            arrBind.push(['string' + i, i, '2020-05-11', '12:35:41.3333333', '2022-04-01 23:59:59', '2022-07-08 12:05:30.9999999']);
          }
          connection.execute({
            sqlText: insertNAB,
            binds: arrBind,
            complete: function (err, stmt) {
              testUtil.checkError(err);
              assert.strictEqual(stmt.getNumUpdatedRows(), count);
              callback();
            }
          });
        },
        function (callback) {
          connection.execute({
            sqlText: selectNAB,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              NABData = rows[0];
              callback();
            }
          });
        },
        function (callback) {
          connection.execute({
            sqlText: selectAB,
            complete: function (err, stmt, rows) {
              testUtil.checkError(err);
              const ABData = rows[0];

              const ABDate = new Date(ABData['COLC']);
              const ABDataD = new Date(ABData['COLD']).getTime();
              const ABDataE = new Date(ABData['COLE']).getTime();
              const ABDataF = new Date(ABData['COLF']).getTime();
              const NABDate = new Date(NABData['COLC']);
              const NABDataD = new Date(NABData['COLD']).getTime();
              const NABDataE = new Date(NABData['COLE']).getTime();
              const NABDataF = new Date(NABData['COLF']).getTime();

              assert.equal(ABData['COLA'], NABData['COLA']);
              assert.equal(ABData['COLB'], NABData['COLB']);
              assert.equal(ABDate.toString(), NABDate.toString());
              assert.equal(ABDataD.toString(), NABDataD.toString());
              assert.equal(ABDataE.toString(), NABDataE.toString());
              assert.equal(ABDataF.toString(), NABDataF.toString());
              callback();
            }
          });
        },
      ],
      done
    );
  });
});

describe('Test Array Bind - full path with cancel', function () {
  this.retries(3); // this test suit are considered as flaky

  let connection;
  const DATABASE_NAME = connOption.valid.database;
  const SCHEMA_NAME = connOption.valid.schema;
  const tableName = `${DATABASE_NAME}.${SCHEMA_NAME}.testAB`;

  const rowsToInsert = 10;
  // we need query to be executed long enough to be able to send cancel before it ends,
  // but we cannot send it too early because its executing could not start yet
  // (then we receive error that query is not running, so we cannot cancel it)
  const delayPerRowMs = 10000;
  const cancelInsertAfterMs = 4000;

  // SYSTEM$WAIT is not supported as insert with binds in regression test, so it's set as default for last column
  const createABTable = `create or replace table ${tableName}(colA string, colB number, colC date, colD time, colE TIMESTAMP_NTZ, colF TIMESTAMP_TZ, colG string default SYSTEM$WAIT(${delayPerRowMs}, 'MILLISECONDS'))`;
  const insertSQL = `insert into ${tableName}(colA, colB, colC, colD, colE, colF)
                     values (?, ?, ?, ?, ?, ?)`;

  before(async () => {
    connection = snowflake.createConnection({
      ...connOption.valid,
      // Set schema and database to null to ensure that full path to table is passed in commands
      schema: undefined,
      database: undefined,
      arrayBindingThreshold: 3,
      forceStageBindError: 0,
    });
    await testUtil.connectAsync(connection);
    await testUtil.executeCmdAsync(connection, createABTable);
  });

  it('Full path array bind with cancel', done => {
    const arrBind = [];
    for (let i = 0; i < rowsToInsert; i++) {
      arrBind.push([null, i, '2020-05-11', '12:35:41.3333333', '2022-04-01 23:59:59', '2022-07-08 12:05:30.9999999']);
    }

    const insertABStmt = connection.execute({
      sqlText: insertSQL,
      binds: arrBind,
      complete: function (err) {
        Logger.getInstance().trace('Finished insert: %s', insertSQL);
        if (err) {
          Logger.getInstance().trace('insert error=%s', JSON.stringify(err));
          assert.equal(err, 'OperationFailedError: SQL execution canceled');
          done();
        } else {
          done(new Error('Insert should be cancelled'));
        }
      }
    });

    Logger.getInstance().trace('setting timeout');
    setTimeout(() => {
      Logger.getInstance().trace('Cancel sent');
      insertABStmt.cancel(function (err) {
        if (err) {
          Logger.getInstance().trace('Full path array bind with cancel: Cancel error=%s', JSON.stringify(err));
        } else {
          Logger.getInstance().trace('Full path array bind with cancel: Successfully aborted statement');
        }
      });
    }, cancelInsertAfterMs);
  });

  after(async () => {
    await testUtil.dropTablesIgnoringErrorsAsync(connection, [tableName]);
    await testUtil.destroyConnectionAsync(connection);
  });
});
