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

  it('Connect using Key Pair', function (done)
  {
    var connection = snowflake.createConnection(connOption.validKeyPairAuth);
    connection.connect(function (err)
    {
      assert.ok(!err, JSON.stringify(err));
      done();
    });
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
