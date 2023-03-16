/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
const Os = require('os');
const async = require('async');
const assert = require('assert');
const snowflake = require('./../../lib/snowflake');
const connOption = require('./connectionOptions');
const SocketUtil = require('./../../lib/agent/socket_util');
const OcspResponseCache = require('./../../lib/agent/ocsp_response_cache');
const Check = require('./../../lib/agent/check');
const Util = require('./../../lib/util');
const { exec } = require('child_process');
const testUtil = require('./testUtil');

const sharedLogger = require('./sharedLogger');
const Logger = require('./../../lib/logger');
Logger.getInstance().setLogger(sharedLogger.logger);


describe('OCSP validation', function ()
{
  it('OCSP validation with server reusing SSL sessions', function (done)
  {
    const connection = snowflake.createConnection(connOption.valid);

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

  function deleteCache()
  {
    OcspResponseCache.deleteCache();
  }

  it('OCSP validation expired local cache', function (done)
  {
    deleteCache();
    process.env.SF_OCSP_TEST_CACHE_MAXAGE = 5;
    const connection = snowflake.createConnection(connOption.valid);

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
          var numStmtsTotal = 5;

          // execute a simple statement several times
          // and make sure there are no errors
          for (var index = 0; index < numStmtsTotal; index++)
          {
            setTimeout(function () {
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
                      delete process.env['SF_OCSP_TEST_CACHE_MAXAGE'];
                      assert.strictEqual(numErrors, 0);
                      callback();
                    }
                  }
                });
              // cache expire in 5 seconds while 3 seconds per query, so it
              // would cover both case of expired and not expired
              }, 3000);
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
        if (!err.hasOwnProperty('code'))
        {
          console.log(err);
        }
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
    deleteCache();
    const testOptions = function (i)
    {
      const connection = snowflake.createConnection(httpsEndpoints[i]);
      connectToHttpsEndpoint(testOptions, i, connection, done)
    };
    testOptions(0);
  });

  it('Test Ocsp with different endpoints - force to download cache', function (done)
  {
    deleteCache();
    SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;

    function cleanup()
    {
      done();
    }

    const testOptions = function (i)
    {
      const connection = snowflake.createConnection(httpsEndpoints[i]);
      connectToHttpsEndpoint(testOptions, i, connection, cleanup)
    };
    testOptions(0);
  });

  it('Test Ocsp with different endpoints - download cache in FAIL_CLOSED', function (done)
  {
    deleteCache();
    SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;

    function cleanup()
    {
      snowflake.configure({ocspFailOpen: true});
      done();
    }

    const testOptions = function (i)
    {
      snowflake.configure({ocspFailOpen: false});
      const connection = snowflake.createConnection(httpsEndpoints[i]);
      connectToHttpsEndpoint(testOptions, i, connection, cleanup);
    };
    testOptions(0);
  });

  it('Test Ocsp with different endpoints - no cache server in FAIL_CLOSED', function (done)
  {
    deleteCache();
    SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;
    SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = false;

    function cleanup()
    {
      SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = true;
      snowflake.configure({ocspFailOpen: true});
      done();
    }

    const testOptions = function (i)
    {
      snowflake.configure({ocspFailOpen: false});
      const connection = snowflake.createConnection(httpsEndpoints[i]);
      connectToHttpsEndpoint(testOptions, i, connection, cleanup);
    };
    testOptions(0);
  });

  it('Test Ocsp with different endpoints - no cache server or file', function (done)
  {
    deleteCache();
    SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;
    SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = false;

    function cleanup()
    {
      SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = true;
      done();
    }

    const testOptions = function (i)
    {
      const connection = snowflake.createConnection(httpsEndpoints[i]);
      connectToHttpsEndpoint(testOptions, i, connection, cleanup);
    };
    testOptions(0);
  });

  it('Test Ocsp with different endpoints - no cache directory access', function (done)
  {
    const platform = Os.platform();
    if (platform === "linux")
    {
      deleteCache();
      SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;
      process.env['SF_OCSP_RESPONSE_CACHE_DIR'] = '/usr';

      function cleanup()
      {
        delete process.env['SF_OCSP_RESPONSE_CACHE_DIR'];
        done();
      }

      const testOptions = function (i)
      {
        const connection = snowflake.createConnection(httpsEndpoints[i]);
        connectToHttpsEndpoint(testOptions, i, connection, cleanup);
      };
      testOptions(0);
    }
    else
    {
      done();
    }
  });

  it('Test OCSP with different OCSP modes enabled', function (done)
  {
    deleteCache();
    const globalOptions = [
      {
        ocspFailOpen: true
      },
      {
        ocspFailOpen: false
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
    snowflake.configure({ocspFailOpen: true});

    done();
  });
});

describe('OCSP privatelink', function ()
{
  const mockUrl = `http://www.mockAccount.com`;
  const mockParsedUrl = require('url').parse(mockUrl);
  const mockDataBuf = Buffer.from('mockData');
  const mockFunc = function () { return; };
  const mockReq =
  {
    uri: mockUrl,
    req: {
      data: mockDataBuf,
    }
  };

  const host = Util.construct_hostname(connOption.privatelink.region, connOption.privatelink.account);
  const ocspResponseCacheServerUrl = `http://ocsp.${host}/ocsp_response_cache.json`;
  const ocspResponderUrl = `http://ocsp.${host}/retry/${mockParsedUrl.hostname}/${mockDataBuf.toString('base64')}`;

  it('Account with privatelink', function (done)
  {
    var connection = snowflake.createConnection(connOption.privatelink);

    connection.connect(function (err)
    {
      assert.ok(!err, JSON.stringify(err));

      Check(null, mockFunc, mockReq);

      assert.strictEqual(process.env.SF_OCSP_RESPONSE_CACHE_SERVER_URL, ocspResponseCacheServerUrl);
      assert.strictEqual(process.env.SF_OCSP_RESPONDER_URL, ocspResponderUrl);

      delete process.env['SF_OCSP_RESPONSE_CACHE_SERVER_URL'];
      delete process.env['SF_OCSP_RESPONDER_URL'];

      done();
    });
  });

  it('Account without privatelink', function (done)
  {
    var connection = snowflake.createConnection(connOption.valid);
    connection.connect(function (err)
    {
      assert.ok(!err, JSON.stringify(err));

      Check(null, mockFunc, mockReq);

      assert.strictEqual(process.env.SF_OCSP_RESPONSE_CACHE_SERVER_URL, undefined);
      assert.strictEqual(process.env.SF_OCSP_RESPONDER_URL, undefined);

      done();
    });
  });
});

// Skipped - requires manual interaction to set the network interface in system command and enter sudo user password
describe.skip('Test Ocsp with network delay', function ()
{
  this.timeout(500000);
  var connection;

  before(function (done)
  {
    exec("sudo tc qdisc add dev eth0 root netem delay 5000ms");
    done();
  });

  after(function (done)
  {
    exec("sudo tc qdisc delete dev eth0 root");
    testUtil.destroyConnection(connection, done);
  });

  it('Force to download cache with network delay', function (done)
  {
    const platform = Os.platform();
    if (platform === "linux")
    {
      OcspResponseCache.deleteCache();
      SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;
      snowflake.configure({ocspFailOpen: false});
      connection = snowflake.createConnection(connOption.valid);

      async.series([
          function (callback)
          {
            connection.connect(function (err, conn)
            {
              assert.ok(!err, JSON.stringify(err));
              callback();
            });
          }
        ],
        done
      );
    }
    else
    {
      done();
    }
  });
});