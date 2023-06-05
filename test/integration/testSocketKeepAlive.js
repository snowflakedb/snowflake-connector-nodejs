/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const snowflake = require('../../lib/snowflake');
const connOption = require('./connectionOptions');
const async = require('async');
const testUtil = require('./testUtil');
const { performance } = require('perf_hooks');

describe('Test socketKeepAlive functionality', function ()
{
  this.timeout(15_000);

  var connection;
  const LOOP_COUNT = 3;

  function executeQueryLoop(connOptions, queryLoopDone) {
    let sum = 0;
    async.series(
      [
        // Create the connection
        function (callback)
        {
          console.time('connecting')
          connection = snowflake.createConnection(connOptions);
          connection.connect(function (err, conn)
          {
            if (err)
            {
              console.error('Unable to connect: ' + err.message);
            } else
            {
              console.timeEnd('connecting');
              callback();
            }
          });
        },
        // Run the query LOOP_COUNT times
        async function ()
        {
          for (var count = 1; count <= LOOP_COUNT; count++)
          {
            await new Promise((resolve, reject) =>
            {
              var start = performance.now();
              var statement = connection.execute({
                sqlText: "SELECT L_COMMENT from SNOWFLAKE_SAMPLE_DATA.TPCH_SF100.LINEITEM limit 10000;",
                complete: function (err, stmt, rows)
                {
                  var stream = statement.streamRows();
                  stream.on('error', function (err)
                  {
                    done(err);
                  });
                  stream.on('data', function (row)
                  {
                    return;
                  });
                  stream.on('end', function (row)
                  {
                    var end = performance.now();
                    var time = end - start;
                    console.log("query: " + time);
                    sum += time;
                    resolve();
                  });
                }
              });
            });
          }
          console.log(`total elapsed: ${sum}, query average: ${(sum / LOOP_COUNT)}`);
          console.timeEnd('execution');
        }
      ],
      () => queryLoopDone(sum)
    );
  }

  const testCases = [
    ['direct connection', connOption.valid],
  ];

  for (const [title, connOptions] of testCases) {
    describe(title, function ()
    {
      let keepAliveDisabledElapsed = 0;
      let keepAliveEnabledElapsed = 0;

      describe('query loops', function () {
        beforeEach(function (done)
        {
          console.time('execution');
          done();
        });
      
        afterEach(function (done)
        {
          testUtil.destroyConnection(connection, done);
        });

        it('works with socketKeepAlive: false', function (done) {
          executeQueryLoop({ ...connOptions, socketKeepAlive: false }, (elapsed) => {
            keepAliveDisabledElapsed = elapsed;
            done();
          })
        });

        it('works with socketKeepAlive: true (default)', function (done) {
          executeQueryLoop(connOptions, (elapsed) => {
            keepAliveEnabledElapsed = elapsed;
            done();
          })
        });
      });

      after(function () {
        const expected = keepAliveDisabledElapsed * (2/3);
        // Assert that multiple queries with socketKeepAlive enabled take less than 2/3 the time of those with socketKeepAlive disabled.
        // Realistically we can expect to see a much greater performance benefit than this, but this is conservative to avoid flakiness.
        assert(
          keepAliveEnabledElapsed - expected < 0,
          `keepAliveEnabledElapsed is too high (expected: <= ${expected}, actual: ${keepAliveEnabledElapsed})`
        );
      });
    });
  }
});
