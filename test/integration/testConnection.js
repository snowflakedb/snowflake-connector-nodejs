/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */
const snowflake = require('./../../lib/snowflake');
const async = require('async');
const assert = require('assert');
const connOption = require('./connectionOptions');
const testUtil = require('./testUtil');
const Util = require('./../../lib/util');
const Core = require('./../../lib/core');
const stdout = require("test-console").stdout;

describe('Connection test', function ()
{
  it('return tokens in qaMode', function ()
    {
      const coreInst = Core({
        qaMode: true,
        httpClientClass: require('./../../lib/http/node'),
        loggerClass: require('./../../lib/logger/node'),
        client:
          {
            version: Util.driverVersion,
            environment: process.versions
          }
      });
      const connection = coreInst.createConnection(connOption.valid);
      assert.deepEqual(connection.getTokens(), {
        masterToken: undefined,
        masterTokenExpirationTime: undefined,
        sessionToken: undefined,
        sessionTokenExpirationTime: undefined
      });
    }
  )
  ;

  it('does not return tokens when not in qaMode', function ()
    {
      const connection = snowflake.createConnection(connOption.valid);
      assert.deepEqual(connection.getTokens(), {});
    }
  )
  ;
  it('Simple Connect', function (done)
  {
    var connection = snowflake.createConnection(connOption.valid);

    async.series([
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
          assert.ok(connection.isUp(), "not active");
          callback();
        },
        function (callback)
        {
          connection.destroy(function (err)
          {
            assert.ok(!err, JSON.stringify(err));
            callback();
          });
        },
        function (callback)
        {
          assert.ok(!connection.isUp(), "still active");
          callback();
        },
      ],
      done
    );
  });

  it('Wrong Username', function (done)
  {
    var connection = snowflake.createConnection(connOption.wrongUserName);
    connection.connect(function (err)
    {
      assert.ok(err, 'Username is an empty string');
      assert.equal('Incorrect username or password was specified.', err["message"]);
      done();
    });
  });

  it('Wrong Password', function (done)
  {
    var connection = snowflake.createConnection(connOption.wrongPwd);
    connection.connect(function (err)
    {
      assert.ok(err, 'Password is an empty string');
      assert.equal('Incorrect username or password was specified.', err["message"]);
      done();
    });
  });
  it('Multiple Client', function (done)
  {
    const totalConnections = 10;
    var connections = [];
    for (var i = 0; i < totalConnections; i++)
    {
      connections.push(snowflake.createConnection(connOption.valid));
    }
    var completedConnection = 0;
    for (i = 0; i < totalConnections; i++)
    {
      connections[i].connect(function (err, conn)
      {
        testUtil.checkError(err);
        conn.execute({
          sqlText: 'select 1',
          complete: function (err)
          {
            testUtil.checkError(err);
            testUtil.destroyConnection(conn, function ()
            {
            });
            completedConnection++;
          }
        });
      });
    }
    setTimeout(function ()
    {
      assert.strictEqual(completedConnection, totalConnections);
      done();
    }, 60000);
  });
});

// Skipped - requires manual interaction to enter credentials on browser
describe.skip('Connection test - external browser', function ()
{
  this.timeout(10000);

  it('Simple Connect', function (done)
  {
    var connection = snowflake.createConnection(connOption.externalBrowser);

    async.series([
        function (callback)
        {
          connection.connectAsync(function (err)
          {
            done(err);
            assert.ok(!err, JSON.stringify(err));
            callback();
          });
        },
        function (callback)
        {
          assert.ok(connection.isUp(), "not active");
          callback();
        },
        function (callback)
        {
          connection.destroy(function (err)
          {
            assert.ok(!err, JSON.stringify(err));
            callback();
          });
        },
        function (callback)
        {
          assert.ok(!connection.isUp(), "still active");
          callback();
        },
      ],
    );
  });

  it('Mismatched Username', function (done)
  {
    var connection = snowflake.createConnection(connOption.externalBrowserMismatchUser);
    connection.connectAsync(function (err)
    {
      try
      {
        assert.ok(err, 'Logged in with different user than one on connection string');
        assert.equal('The user you were trying to authenticate as differs from the user currently logged in at the IDP.', err["message"]);
        done();
      }
      catch (err)
      {
        done(err);
      }
    })
  });
});

describe.skip('Connection test - keypair', function ()
{
  it('Simple Connect - specify private key', function (done)
  {
    var connection = snowflake.createConnection(connOption.keypairPrivateKey);

    async.series([
      function (callback)
      {
        connection.connect(function (err)
        {
          done(err);
          assert.ok(!err, JSON.stringify(err));
          callback();
        });
      },
      function (callback)
      {
        assert.ok(connection.isUp(), "not active");
        callback();
      },
      function (callback)
      {
        connection.destroy(function (err)
        {
          assert.ok(!err, JSON.stringify(err));
          callback();
        });
      },
      function (callback)
      {
        assert.ok(!connection.isUp(), "still active");
        callback();
      },
    ],
    );
  });

  it.skip('Simple Connect - specify encrypted private key path and passphrase', function (done)
  {
    var connection = snowflake.createConnection(connOption.keypairPathEncrypted);

    async.series([
      function (callback)
      {
        connection.connect(function (err)
        {
          done(err);
          assert.ok(!err, JSON.stringify(err));
          callback();
        });
      },
      function (callback)
      {
        assert.ok(connection.isUp(), "not active");
        callback();
      },
      function (callback)
      {
        connection.destroy(function (err)
        {
          assert.ok(!err, JSON.stringify(err));
          callback();
        });
      },
      function (callback)
      {
        assert.ok(!connection.isUp(), "still active");
        callback();
      },
    ],
    );
  });

  it.skip('Simple Connect - specify unencrypted private key path without passphrase', function (done)
  {
    var connection = snowflake.createConnection(connOption.keypairPathEncrypted);

    async.series([
      function (callback)
      {
        connection.connect(function (err)
        {
          done(err);
          assert.ok(!err, JSON.stringify(err));
          callback();
        });
      },
      function (callback)
      {
        assert.ok(connection.isUp(), "not active");
        callback();
      },
      function (callback)
      {
        connection.destroy(function (err)
        {
          assert.ok(!err, JSON.stringify(err));
          callback();
        });
      },
      function (callback)
      {
        assert.ok(!connection.isUp(), "still active");
        callback();
      },
    ],
    );
  });

  it('Wrong JWT token', function (done)
  {
    var connection = snowflake.createConnection(connOption.keypairWrongToken);
    connection.connect(function (err)
    {
      try
      {
        assert.ok(err, 'Incorrect JWT token is passed.');
        assert.equal('JWT token is invalid.', err["message"]);
        done();
      }
      catch (err)
      {
        done(err);
      }
    })
  });
});

// Skipped - requires manual interaction to obtain oauth token
describe.skip('Connection test - oauth', function ()
{
  it('Simple Connect', function (done)
  {
    var connection = snowflake.createConnection(connOption.oauth);

    async.series([
      function (callback)
      {
        connection.connect(function (err)
        {
          done(err);
          assert.ok(!err, JSON.stringify(err));
          callback();
        });
      },
      function (callback)
      {
        assert.ok(connection.isUp(), "not active");
        callback();
      },
      function (callback)
      {
        connection.destroy(function (err)
        {
          assert.ok(!err, JSON.stringify(err));
          callback();
        });
      },
      function (callback)
      {
        assert.ok(!connection.isUp(), "still active");
        callback();
      },
    ],
    );
  });

  it('Mismatched Username', function (done)
  {
    var connection = snowflake.createConnection(connOption.oauthMismatchUser);
    connection.connect(function (err)
    {
      try
      {
        assert.ok(err, 'Logged in with different user than one on connection string');
        assert.equal('The user you were trying to authenticate as differs from the user tied to the access token.', err["message"]);
        done();
      }
      catch (err)
      {
        done(err);
      }
    })
  });
});

describe.skip('Connection test - okta', function ()
{
  it('Simple Connect', function (done)
  {
    var connection = snowflake.createConnection(connOption.okta);

    async.series([
      function (callback)
      {
        connection.connectAsync(function (err)
        {
          done(err);
          assert.ok(!err, JSON.stringify(err));
          callback();
        });
      },
      function (callback)
      {
        assert.ok(connection.isUp(), "not active");
        callback();
      },
      function (callback)
      {
        connection.destroy(function (err)
        {
          assert.ok(!err, JSON.stringify(err));
          callback();
        });
      },
      function (callback)
      {
        assert.ok(!connection.isUp(), "still active");
        callback();
      },
    ],
    );
  });
});

describe('Connection test - validate default parameters', function ()
{
  it('Valid "warehouse" parameter', function ()
  {
    const output = stdout.inspectSync(() =>
    {
      snowflake.createConnection({
        account: connOption.valid.account,
        username: connOption.valid.username,
        password: connOption.valid.password,
        warehouse: 'testWarehouse',
        validateDefaultParameters: true
      });
    });
    assert.deepEqual(output, []);
  });

  it('Invalid "warehouse" parameter', function ()
  {
    const output = stdout.inspectSync(() =>
    {
      snowflake.createConnection({
        account: connOption.valid.account,
        username: connOption.valid.username,
        password: connOption.valid.password,
        waerhouse: 'testWarehouse',
        validateDefaultParameters: true
      });
    });
    assert.deepEqual(output,
      [
        "\"waerhouse\" is an unknown connection parameter\n",
        "Did you mean \"warehouse\"\n"
      ]);
  });

  it('Valid "database" parameter', function ()
  {
    const output = stdout.inspectSync(() =>
    {
      snowflake.createConnection({
        account: connOption.valid.account,
        username: connOption.valid.username,
        password: connOption.valid.password,
        database: 'testDatabase',
        validateDefaultParameters: true
      });
    });
    assert.deepEqual(output, []);
  });

  it('Invalid "db" parameter', function ()
  {
    const output = stdout.inspectSync(() =>
    {
      snowflake.createConnection({
        account: connOption.valid.account,
        username: connOption.valid.username,
        password: connOption.valid.password,
        db: 'testDb',
        validateDefaultParameters: true
      });
    });
    assert.deepEqual(output,
      [
        "\"db\" is an unknown connection parameter\n",
      ]);
  });

  it('Invalid "database" parameter', function ()
  {
    const output = stdout.inspectSync(() =>
    {
      snowflake.createConnection({
        account: connOption.valid.account,
        username: connOption.valid.username,
        password: connOption.valid.password,
        datbse: 'testDatabase',
        validateDefaultParameters: true
      });
    });
    assert.deepEqual(output,
      [
        "\"datbse\" is an unknown connection parameter\n",
        "Did you mean \"database\"\n"
      ]);
  });

  it('Valid "schema" parameter', function ()
  {
    const output = stdout.inspectSync(() =>
    {
      snowflake.createConnection({
        account: connOption.valid.account,
        username: connOption.valid.username,
        password: connOption.valid.password,
        schema: 'testSchema',
        validateDefaultParameters: true
      });
    });
    assert.deepEqual(output, []);
  });

  it('Invalid "schema" parameter', function ()
  {
    const output = stdout.inspectSync(() =>
    {
      snowflake.createConnection({
        account: connOption.valid.account,
        username: connOption.valid.username,
        password: connOption.valid.password,
        shcema: 'testSchema',
        validateDefaultParameters: true
      });
    });
    assert.deepEqual(output,
      [
        "\"shcema\" is an unknown connection parameter\n",
        "Did you mean \"schema\"\n"
      ]);
  });
});
