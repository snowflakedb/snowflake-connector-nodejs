/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
const async = require('async');
const assert = require('assert');
const snowflake = require('./../../lib/snowflake');
const connOption = require('./connectionOptions');
const SocketUtil = require('./../../lib/agent/socket_util');
const OcspResponseCache = require('./../../lib/agent/ocsp_response_cache');

describe('OCSP validation', function ()
{
  it('OCSP validation with server reusing SSL sessions', function (done)
  {
    var connection = snowflake.createConnection(connOption.valid);

    // execute several statements in quick succession to make sure some SSL
    // sessions get reused on the server-side, and our OCSP validation logic
    // doesn't barf (when an SSL session is reused, the certificate validation
    // step should be skipped)
    async.series(
      [
        function (callback)
        {
          connection.connect(function (err)
          {
            assert.ok(!err, JSON.stringify(err));
            callback();
          });
        },
        function (callback)
        {
          var numErrors = 0;
          var numStmtsExecuted = 0;
          var numStmtsTotal = 20;

          // execute a simple statement several times
          // and make sure there are no errors
          for (var index = 0; index < numStmtsTotal; index++)
          {
            connection.execute(
              {
                sqlText: 'select 1;',
                complete: function (err)
                {
                  if (err)
                  {
                    numErrors++;
                  }

                  numStmtsExecuted++;
                  if (numStmtsExecuted === (numStmtsTotal - 1))
                  {
                    assert.strictEqual(numErrors, 0);
                    callback();
                  }
                }
              });
          }
        }
      ], done);
  });

  const httpsEndpoints = [
    {
      accessUrl: "https://sfcsupport.snowflakecomputing.com",
      account: "sfcsupport",
      username: "fake_user",
      password: "fake_password"
    },

    {
      accessUrl: "https://sfcsupporteu.eu-centraol-1.snowflakecomputing.com",
      account: "sfcsupporteu",
      username: "fake_user",
      password: "fake_password"
    },

    {
      accessUrl: "https://sfcsupportva.us-east-1.snowflakecomputing.com",
      account: "sfcsupportva",
      username: "fake_user",
      password: "fake_password"
    },

    {
      accessUrl: "https://aztestaccount.east-us-2.azure.snowflakecomputing.com",
      account: "aztestaccount",
      username: "fake_user",
      password: "fake_password"
    }
  ];

  function connectToHttpsEndpoint(testOptions, i, connection, done)
  {
    connection.connect(function (err)
    {
      assert.ok(err);
      if (err)
      {
        assert.equal(err['code'], '390100');
      }

      if (i === testOptions.length - 1)
      {
        done();
      }
      else
      {
        testOptions(i + 1);
      }
    });

  }

  it('Test Ocsp with different endpoints', function (done)
  {
    var testOptions = function (i)
    {
      var connection = snowflake.createConnection(httpsEndpoints[i]);
      connectToHttpsEndpoint(testOptions, i, connection, done)
    };
    testOptions(0);
  });

  it('Test Ocsp with different endpoints - force to download cache', function (done)
  {
    if (SocketUtil.variables.OCSP_RESPONSE_CACHE)
    {
      SocketUtil.variables.OCSP_RESPONSE_CACHE.deleteCache();
    }
    SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;

    var testOptions = function (i)
    {
      var connection = snowflake.createConnection(httpsEndpoints[i]);
      connectToHttpsEndpoint(testOptions, i, connection, done)
    };
    testOptions(0);
  });

  it('Test Ocsp with different endpoints - no cache server or file', function (done)
  {
    if (SocketUtil.variables.OCSP_RESPONSE_CACHE)
    {
      SocketUtil.variables.OCSP_RESPONSE_CACHE.deleteCache();
    }
    SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;
    SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = false;

    function resetCacheServer()
    {
      SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = true;
      done();
    }

    var testOptions = function (i)
    {
      var connection = snowflake.createConnection(httpsEndpoints[i]);
      connectToHttpsEndpoint(testOptions, i, connection, resetCacheServer)
    };
    testOptions(0);
  });

  it('Test OCSP with different OCSP modes enabled', function (done)
  {
    var globalOptions = [
      {
        ocspMode: snowflake.ocspModes.FAIL_OPEN
      },
      {
        ocspMode: snowflake.ocspModes.FAIL_CLOSED
      },
      {
        ocspMode: snowflake.ocspModes.INSECURE
      }
    ];

    for (let i = 0; i < globalOptions.length; i++)
    {
      snowflake.configure(globalOptions[i]);
      let connection = snowflake.createConnection(connOption.valid);
      connection.connect(function (err)
      {
        assert.ok(!err, JSON.stringify(err));
      })
    }

    done();
  });
});
