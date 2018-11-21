/*
 * Copyright (c) 2015-2018 Snowflake Computing Inc. All rights reserved.
 */
var snowflake  = require('./../../lib/snowflake');
var async = require('async');
var assert = require('assert');
var connOption = require('./connectionOptions');
var testUtil = require('./testUtil');

describe('Connection test', function()
{
  it('Simple Connect', function(done)
  {
    var connection = snowflake.createConnection(connOption.valid);

    async.series([
        function(callback)
        {
          connection.connect(function(err)
          {
            assert.ok(!err, JSON.stringify(err));
            callback();
          });
        },
        function(callback)
        {
          assert.ok(connection.isUp(), "not active");
          callback();
        },
        function(callback)
        {
          connection.destroy(function(err)
          {
            assert.ok(!err, JSON.stringify(err));
            callback();
          });
        },
        function(callback)
        {
          assert.ok(!connection.isUp(), "still active");
          callback();
        },
      ],
      done
    );
  });

  it('Wrong Username', function(done)
  {
    var connection = snowflake.createConnection(connOption.wrongUserName);
    connection.connect(function(err)
    {
      assert.ok(err, 'Username is an empty string');
      assert.equal('Incorrect username or password was specified.', err["message"]);
      done();
    });
  });

  it('Wrong Password', function(done)
  {
    var connection = snowflake.createConnection(connOption.wrongPwd);
    connection.connect(function(err)
    {
      assert.ok(err, 'Password is an empty string');
      assert.equal('Incorrect username or password was specified.', err["message"]);
      done();
    });
  });

  it('Multiple Client', function(done) {
    const totalConnections = 10;
    var connections = [];
    for (var i = 0; i < totalConnections; i++) {
      connections.push(snowflake.createConnection(connOption.valid));
    }
    var completedConnection = 0;
    for (i = 0; i < totalConnections; i++) {
      connections[i].connect(function (err, conn) {
        testUtil.checkError(err);
        conn.execute({
          sqlText: 'select 1',
          complete: function(err)
          {
            testUtil.checkError(err);
            testUtil.destroyConnection(conn, function(){});
            completedConnection ++;
          }
        });
      });
    }
    setTimeout(function(){
      assert.strictEqual(completedConnection, totalConnections);
      done();
    }, 60000);
  });
});
