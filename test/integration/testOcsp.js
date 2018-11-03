/*
 * Copyright (c) 2015-2018 Snowflake Computing Inc. All rights reserved.
 */
var async      = require('async');
var assert     = require('assert');
var snowflake  = require('./../../lib/snowflake');
var connOption = require('./connectionOptions');

describe('OCSP validation', function()
{
  it('OCSP validation with server reusing SSL sessions', function(done)
  {
    var connection = snowflake.createConnection(connOption.valid);

    // execute several statements in quick succession to make sure some SSL
    // sessions get reused on the server-side, and our OCSP validation logic
    // doesn't barf (when an SSL session is reused, the certificate validation
    // step should be skipped)
    async.series(
    [
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
            complete: function(err)
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

  it('Test Ocsp with different endpoints', function(done)
  {
    var options = [
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
        accessUrl: "https://sfcsupportva.us-east-1.snowflakecomputing.com ",
        account: "sfcsupportva",
        username: "fake_user",
        password: "fake_password"
      },

      {
        accessUrl: "https://aztestaccount.east-us-2.azure.snowflakecomputing.com ",
        account: "aztestaccount",
        username: "fake_user",
        password: "fake_password"
      }
    ];

    var testOptions = function(i)
    {
      var connection = snowflake.createConnection(options[i]);
      connection.connect(function(err){
        assert.ok(err);
        if (err)
        {
          assert.ok(err['code'] === '390100');
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
    };
    testOptions(0);
  });
});