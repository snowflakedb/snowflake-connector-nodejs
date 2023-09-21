/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

const snowflake = require('./../../lib/snowflake');
const connOption = require('./connectionOptions');
const async = require('async');
const testUtil = require('./testUtil');
const { performance } = require('perf_hooks');
const assert = require("assert");

describe('keepAlive test', function ()
{
  let connection;
  const loopCount = 5;
  const rowCount = 10;
  const tableName = 'test_keepalive000';

  const createTableWithRandomStrings = `CREATE OR REPLACE TABLE ${tableName} (value string)
    AS select randstr(200, random()) from table (generator(rowcount =>${rowCount}))`;

  after(async () => {
    await testUtil.dropTablesIgnoringErrorsAsync(connection, [tableName]);
    await testUtil.destroyConnectionAsync(connection);
  });

  it('Run query in loop', function (done)
  {
    let sumWithKeepAlive = 0;
    let sumWithoutKeepAlive = 0;
    async.series(
      [
        // Run the query loopCount times
        async function ()
        {
          connection = snowflake.createConnection(connOption.valid);
          await testUtil.connectAsync(connection);
          await testUtil.executeCmdAsync(connection, createTableWithRandomStrings);
          for (let count = 1; count <= loopCount; count++)
          {
            await new Promise((resolve, reject) =>
            {
              const start = performance.now();
              connection.execute({
                sqlText: `SELECT VALUE from ${tableName} limit ${rowCount};`,
                streamResult: true,
                complete: function (err, stmt) {
                  if (err) {
                    done(err);
                  } else {
                    stmt.streamRows()
                      .on('error', function (err) {
                        done(err);
                      })
                      .on('data', function (row) {
                        return;
                      })
                      .on('end', function (row) {
                        const end = performance.now();
                        const time = end - start;
                        sumWithKeepAlive += time;
                        resolve();
                      });
                  }
                }
              });
            });
          }
        },
        async function ()
        {
          snowflake.configure({keepAlive: false});
          connection = snowflake.createConnection(connOption.valid);
          await testUtil.connectAsync(connection);
          await testUtil.executeCmdAsync(connection, createTableWithRandomStrings);
          for (let count = 1; count <= loopCount; count++)
          {
            await new Promise((resolve, reject) =>
            {
              const start = performance.now();
              connection.execute({
                sqlText: `SELECT VALUE from ${tableName} limit ${rowCount};`,
                streamResult: true,
                complete: function (err, stmt) {
                  if (err) {
                    done(err);
                  } else {
                    stmt.streamRows()
                      .on('error', function (err) {
                        done(err);
                      })
                      .on('data', function (row) {
                        return;
                      })
                      .on('end', function (row) {
                        const end = performance.now();
                        const time = end - start;
                        sumWithoutKeepAlive += time;
                        resolve();
                      });
                  }
                }
              });
            });
          }
        },
        async function ()
        {
          assert.ok(sumWithoutKeepAlive/2 > sumWithKeepAlive, 'With keep alive queries should work more thdn two times faster');
        }
      ],
      done
    );
  });
});
