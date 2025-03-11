const assert = require('assert');
const async = require('async');
const testUtil = require('./testUtil');
const ErrorCodes = require('../../lib/errors').codes;
const QueryStatus = require('../../lib/constants/query_status').code;

describe('ExecuteAsync test', function () {
  let connection;

  before(async () => {
    connection = testUtil.createConnection();
    await testUtil.connectAsync(connection);
  });

  after(async () => {
    await testUtil.destroyConnectionAsync(connection);
  });

  it('testAsyncQueryWithPromise', function (done) {
    const expectedSeconds = 3;
    const sqlText = `CALL SYSTEM$WAIT(${expectedSeconds}, 'SECONDS')`;
    let queryId;

    async.series(
      [
        // Execute query in async mode
        function (callback) {
          connection.execute({
            sqlText: sqlText,
            asyncExec: true,
            complete: async function (err, stmt) {
              assert.ok(!err);
              queryId = stmt.getQueryId();
              const status = await connection.getQueryStatus(queryId);
              assert.ok(connection.isStillRunning(status));
              callback();
            }
          });
        },
        // Get results using query id
        async function () {
          const statement = await connection.getResultsFromQueryId({ queryId: queryId });

          await new Promise((resolve, reject) => {
            statement.streamRows()
              .on('error', (err) => reject(err))
              .on('data', (row) => assert.strictEqual(row['SYSTEM$WAIT'], `waited ${expectedSeconds} seconds`))
              .on('end', async () => {
                const status = await connection.getQueryStatus(queryId);
                assert.strictEqual(QueryStatus[status], QueryStatus.SUCCESS);
                resolve();
              });
          });
        }
      ],
      done
    );
  });

  it('testAsyncQueryWithCallback', function (done) {
    const expectedSeconds = 3;
    const sqlText = `CALL SYSTEM$WAIT(${expectedSeconds}, 'SECONDS')`;
    let queryId;

    async.series(
      [
        // Execute query in async mode
        function (callback) {
          connection.execute({
            sqlText: sqlText,
            asyncExec: true,
            complete: async function (err, stmt) {
              assert.ok(!err);
              queryId = stmt.getQueryId();
              const status = await connection.getQueryStatus(queryId);
              assert.ok(connection.isStillRunning(status));
              callback();
            }
          });
        },
        // Get results using query id
        function (callback) {
          connection.getResultsFromQueryId({
            queryId: queryId,
            complete: async function (err, _stmt, rows) {
              assert.ok(!err);
              const status = await connection.getQueryStatus(queryId);
              assert.strictEqual(QueryStatus[status], QueryStatus.SUCCESS);
              assert.strictEqual(rows[0]['SYSTEM$WAIT'], `waited ${expectedSeconds} seconds`);
              callback();
            }
          });
        }
      ],
      done
    );
  });

  it('testFailedQueryThrowsError', function (done) {
    const sqlText = 'select * from fakeTable';
    const timeoutInMs = 1000; // 1 second
    let queryId;

    async.series(
      [
        // Execute query in async mode
        function (callback) {
          connection.execute({
            sqlText: sqlText,
            asyncExec: true,
            complete: async function (err, stmt) {
              assert.ok(!err);
              queryId = stmt.getQueryId();
              callback();
            }
          });
        },
        async function () {
          // Wait for query to finish executing
          while (connection.isStillRunning(await connection.getQueryStatus(queryId))) {
            await new Promise((resolve) => {
              setTimeout(() => resolve(), timeoutInMs);
            });
          }

          // Check query status failed
          const status = await connection.getQueryStatus(queryId);
          assert.strictEqual(QueryStatus[status], QueryStatus.FAILED_WITH_ERROR);
          assert.ok(connection.isAnError(status));

          // Check getting the query status throws an error
          try {
            await connection.getQueryStatusThrowIfError(queryId);
            assert.fail();
          } catch (err) {
            assert.strictEqual(err.name, 'OperationFailedError');
          }

          // Check getting the results throws an error
          try {
            await connection.getResultsFromQueryId({ queryId: queryId });
            assert.fail();
          } catch (err) {
            assert.strictEqual(err.name, 'OperationFailedError');
          }
        }
      ],
      done
    );
  });

  it('testMixedSyncAndAsyncQueries', function (done) {
    const expectedSeconds = '3';
    const sqlTextForAsync = `CALL SYSTEM$WAIT(${expectedSeconds}, 'SECONDS')`;
    const sqlTextForSync = 'select 1';
    let queryId;

    async.series(
      [
        // Execute query in async mode
        function (callback) {
          connection.execute({
            sqlText: sqlTextForAsync,
            asyncExec: true,
            complete: async function (err, stmt) {
              assert.ok(!err);
              queryId = stmt.getQueryId();
              const status = await connection.getQueryStatus(queryId);
              assert.ok(connection.isStillRunning(status));
              callback();
            }
          });
        },
        // Execute a different query in non-async mode
        function (callback) {
          testUtil.executeCmd(connection, sqlTextForSync, callback);
        },
        // Get results using query id
        function (callback) {
          connection.getResultsFromQueryId({
            queryId: queryId,
            complete: async function (_err, _stmt, rows) {
              const status = await connection.getQueryStatus(queryId);
              assert.strictEqual(QueryStatus[status], QueryStatus.SUCCESS);
              assert.strictEqual(rows[0]['SYSTEM$WAIT'], `waited ${expectedSeconds} seconds`);
              callback();
            }
          });
        }
      ],
      done
    );
  });

  it('testGetStatusOfInvalidQueryId', async function () {
    const fakeQueryId = 'fakeQueryId';

    // Get the query status using an invalid query id
    try {
      // Should fail from invalid uuid
      await connection.getQueryStatus(fakeQueryId);
      assert.fail();
    } catch (err) {
      assert.strictEqual(err.code, ErrorCodes.ERR_GET_RESPONSE_QUERY_INVALID_UUID);
    }
  });

  it('testGetResultsOfInvalidQueryId', async function () {
    const fakeQueryId = 'fakeQueryId';

    // Get the queryresults using an invalid query id
    try {
      // Should fail from invalid uuid
      await connection.getResultsFromQueryId({ queryId: fakeQueryId });
      assert.fail();
    } catch (err) {
      assert.strictEqual(err.code, ErrorCodes.ERR_GET_RESPONSE_QUERY_INVALID_UUID);
    }
  });

  it('testGetStatusOfUnknownQueryId', async function () {
    const unknownQueryId = '12345678-1234-4123-A123-123456789012';

    // Get the query status using an unknown query id
    const status = await connection.getQueryStatus(unknownQueryId);
    assert.strictEqual(QueryStatus[status], QueryStatus.NO_QUERY_DATA);
  });

  it('testGetResultsOfUnknownQueryId', async function () {
    const unknownQueryId = '12345678-1234-4123-A123-123456789012';

    // Get the query results using an unknown query id
    try {
      // Should fail from exceeding NO_DATA retry count
      await connection.getResultsFromQueryId({ queryId: unknownQueryId });
      assert.fail();
    } catch (err) {
      assert.strictEqual(err.code, ErrorCodes.ERR_GET_RESULTS_QUERY_ID_NO_DATA);
    }
  });
});
