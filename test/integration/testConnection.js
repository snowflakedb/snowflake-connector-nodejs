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
const stderr = require("test-console").stderr;

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
    const output = stderr.inspectSync(() =>
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
    const output = stderr.inspectSync(() =>
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
    const output = stderr.inspectSync(() =>
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
    const output = stderr.inspectSync(() =>
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
    const output = stderr.inspectSync(() =>
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
    const output = stderr.inspectSync(() =>
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
    const output = stderr.inspectSync(() =>
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

describe('Connection test - connection pool', function ()
{
  this.timeout(10000);

  it('acquire() 1 connection and release()', function (done)
  {
    // Create the connection pool
    var connectionPool = snowflake.createPool(connOption.valid,
      {
        max: 5,
        min: 0
      });

    // Acquire one connection
    const resourcePromise1 = connectionPool.acquire();

    assert.equal(connectionPool.size, 1);
    assert.equal(connectionPool.pending, 1);
    assert.equal(connectionPool.spareResourceCapacity, 4);

    // Once acquired, release the connection
    resourcePromise1.then(function (connection)
    {
      assert.ok(connection.isUp(), "not active");
      assert.equal(connectionPool.pending, 0);

      connectionPool.release(connection).then(() =>
      {
        // One connection should be available for use
        assert.equal(connectionPool.available, 1);
        done();
      });
    });
  });


  it('acquire() 5 connections and release()', function (done)
  {
    // Create the connection pool
    var connectionPool = snowflake.createPool(connOption.valid,
      {
        max: 5,
        min: 0
      });

    // Acquire 5 connections
    const resourcePromise1 = connectionPool.acquire();
    const resourcePromise2 = connectionPool.acquire();
    const resourcePromise3 = connectionPool.acquire();
    const resourcePromise4 = connectionPool.acquire();
    const resourcePromise5 = connectionPool.acquire();

    assert.equal(connectionPool.size, 5);
    assert.equal(connectionPool.pending, 5);
    assert.equal(connectionPool.spareResourceCapacity, 0);

    async.series(
      [
        function (callback)
        {
          // Once acquired, release the connection
          resourcePromise1.then(function (connection)
          {
            assert.ok(connection.isUp(), "not active");
            assert.equal(connectionPool.pending, 4);

            connectionPool.release(connection).then(() =>
            {
              assert.equal(connectionPool.available, 0);
              callback();
            });
          });
        },
        function (callback)
        {
          // Once acquired, release the connection
          resourcePromise2.then(function (connection)
          {
            assert.ok(connection.isUp(), "not active");
            assert.equal(connectionPool.pending, 3);

            connectionPool.release(connection).then(() =>
            {
              assert.equal(connectionPool.available, 0);
              callback();
            });
          });
        },
        function (callback)
        {
          // Once acquired, release the connection
          resourcePromise3.then(function (connection)
          {
            assert.ok(connection.isUp(), "not active");
            assert.equal(connectionPool.pending, 2);

            connectionPool.release(connection).then(() =>
            {
              assert.equal(connectionPool.available, 0);
              callback();
            });
          });
        },
        function (callback)
        {
          // Once acquired, release the connection
          resourcePromise4.then(function (connection)
          {
            assert.ok(connection.isUp(), "not active");
            assert.equal(connectionPool.pending, 1);

            connectionPool.release(connection).then(() =>
            {
              assert.equal(connectionPool.available, 0);
              callback();
            });
          });
        },
        function (callback)
        {
          // Once acquired, release the connection
          resourcePromise5.then(function (connection)
          {
            assert.ok(connection.isUp(), "not active");
            assert.equal(connectionPool.pending, 0);

            connectionPool.release(connection).then(() =>
            {
              assert.equal(connectionPool.available, 1);
              callback();
            });
          });
        },
      ],
      done);
  });

  it('acquire() 1 connection and destroy()', function (done)
  {
    // Create the connection pool
    var connectionPool = snowflake.createPool(connOption.valid,
      {
        max: 5,
        min: 0
      });

    // Acquire one connection
    const resourcePromise1 = connectionPool.acquire();

    assert.equal(connectionPool.size, 1);
    assert.equal(connectionPool.pending, 1);
    assert.equal(connectionPool.spareResourceCapacity, 4);

    // Once acquired, destroy the connection
    resourcePromise1.then(function (connection)
    {
      assert.ok(connection.isUp(), "not active");
      assert.equal(connectionPool.pending, 0);

      connectionPool.destroy(connection).then(() =>
      {
        // No connection should be available for use
        assert.equal(connectionPool.available, 0);
        done();
      });
    });
  });


  it('acquire() 5 connections and destroy()', function (done)
  {
    // Create the connection pool
    var connectionPool = snowflake.createPool(connOption.valid,
      {
        max: 5,
        min: 0
      });

    // Acquire 5 connections
    const resourcePromise1 = connectionPool.acquire();
    const resourcePromise2 = connectionPool.acquire();
    const resourcePromise3 = connectionPool.acquire();
    const resourcePromise4 = connectionPool.acquire();
    const resourcePromise5 = connectionPool.acquire();

    assert.equal(connectionPool.size, 5);
    assert.equal(connectionPool.pending, 5);
    assert.equal(connectionPool.spareResourceCapacity, 0);

    async.series(
      [
        function (callback)
        {
          // Once acquired, release the connection
          resourcePromise1.then(function (connection)
          {
            assert.ok(connection.isUp(), "not active");
            assert.equal(connectionPool.pending, 4);

            connectionPool.destroy(connection).then(() =>
            {
              assert.equal(connectionPool.available, 0);
              callback();
            });
          });
        },
        function (callback)
        {
          // Once acquired, release the connection
          resourcePromise2.then(function (connection)
          {
            assert.ok(connection.isUp(), "not active");
            assert.equal(connectionPool.pending, 3);

            connectionPool.destroy(connection).then(() =>
            {
              assert.equal(connectionPool.available, 0);
              callback();
            });
          });
        },
        function (callback)
        {
          // Once acquired, release the connection
          resourcePromise3.then(function (connection)
          {
            assert.ok(connection.isUp(), "not active");
            assert.equal(connectionPool.pending, 2);

            connectionPool.destroy(connection).then(() =>
            {
              assert.equal(connectionPool.available, 0);
              callback();
            });
          });
        },
        function (callback)
        {
          // Once acquired, release the connection
          resourcePromise4.then(function (connection)
          {
            assert.ok(connection.isUp(), "not active");
            assert.equal(connectionPool.pending, 1);

            connectionPool.destroy(connection).then(() =>
            {
              assert.equal(connectionPool.available, 0);
              callback();
            });
          });
        },
        function (callback)
        {
          // Once acquired, release the connection
          resourcePromise5.then(function (connection)
          {
            assert.ok(connection.isUp(), "not active");
            assert.equal(connectionPool.pending, 0);

            connectionPool.destroy(connection).then(() =>
            {
              assert.equal(connectionPool.available, 0);
              callback();
            });
          });
        },
      ],
      done);
  });

  it('use()', function (done)
  {
    // Create the connection pool
    var connectionPool = snowflake.createPool(connOption.valid,
      {
        max: 5,
        min: 0
      });

    // Use the connection pool, automatically creates a connection
    connectionPool.use(async (connection) =>
    {
      assert.ok(connection.isUp(), "not active");
      assert.equal(connectionPool.size, 1);
      assert.equal(connectionPool.pending, 0);
      assert.equal(connectionPool.spareResourceCapacity, 4);
      assert.equal(connectionPool.available, 0);
    }).then(() =>
    {
      assert.equal(connectionPool.size, 1);
      assert.equal(connectionPool.available, 1);
      done();
    });
  });
});
