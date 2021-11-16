/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

const snowflake = require('./../../lib/snowflake');
const connOption = require('./connectionOptions');
const async = require('async');
const testUtil = require('./testUtil');
const { performance } = require('perf_hooks');

describe.skip('keepAlive perf test', function ()
{
  this.timeout(1000000);

  var connection;
  const LOOP_COUNT = 100;

  before(function (done)
  {
    console.time('execution');
    done();
  });
  after(function (done)
  {
    testUtil.destroyConnection(connection, done);
  });

  it('Run query in loop', function (done)
  {
    async.series(
      [
        // Create the connection
        function (callback)
        {
          console.time('connecting')
          connection = snowflake.createConnection(connOption.valid);
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
          var sum = 0;
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
          console.log("query average: " + (sum / LOOP_COUNT));
          console.timeEnd('execution');
        }
      ],
      done
    );
  });
});
