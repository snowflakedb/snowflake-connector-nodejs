/*
 * Copyright (c) 2021 Snowflake Computing Inc. All rights reserved.
 */

var snowflake = require('./../../../lib/snowflake');

var assert = require('assert');
var fs = require('fs');
var mock = require('mock-require');
var net = require('net');
var path = require('path');

var ErrorCodes = require('./../../../lib/constants/gs_errors');

var auth_web = require('./../../../lib/authentication/auth_web');
var authenticationTypes = require('./../../../lib/authentication/authentication').authenticationTypes;

var obj = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../parameters.json"), 'utf8'));
var connectionConfig = obj.testconnection;

var account = connectionConfig.SNOWFLAKE_TEST_ACCOUNT;
var username = connectionConfig.SNOWFLAKE_TEST_USER;
var password = connectionConfig.SNOWFLAKE_TEST_PASSWORD;
var usernameBrowser = connectionConfig.SNOWFLAKE_TEST_BROWSER_USER;

var defaultConnectionConfig =
  [
    {
      name: 'default',
      options:
      {
        account: account,
        username: username,
        password: password,
      }
    },
    {
      name: 'default - authenticator specified',
      options:
      {
        account: account,
        username: username,
        password: password,
        authenticator: authenticationTypes.DEFAULT_AUTHENTICATOR,
      }
    },
    {
      name: 'default - wrong password',
      options:
      {
        account: account,
        username: username,
        password: '1234',
      }
    }
  ];

var externalConnectionConfig =
  [
    {
      name: 'external browser',
      options:
      {
        account: account,
        username: usernameBrowser,
        authenticator: authenticationTypes.EXTERNAL_BROWSER_AUTHENTICATOR
      }
    }
  ];

describe('default authentication', function ()
{
  this.timeout(5000);
  it('default', function (done)
  {
    var connection = snowflake.createConnection(defaultConnectionConfig[0].options);
    var ret = connection.connect(function (err, conn)
    {
      done(err);
    });

    assert.strictEqual(
      connection, ret, 'connect() should return the connection');
  });

  it('default - authenticator specified', function (done)
  {
    var connection = snowflake.createConnection(defaultConnectionConfig[1].options);
    var ret = connection.connect(function (err, conn)
    {
      done(err);
    });

    assert.strictEqual(
      connection, ret, 'connect() should return the connection');
  });

  it('default - incorrect password', function (done)
  {
    var connection = snowflake.createConnection(defaultConnectionConfig[2].options);
    var ret = connection.connect(function (err, conn)
    {
      try
      {
        assert.equal(err['code'], ErrorCodes.code.INCORRECT_USERNAME_PASSWORD);
        done();
      }
      catch (err)
      {
        done(err);
      }
    });

  assert.strictEqual(
    connection, ret, 'connect() should return the connection');
  });
});

describe('external browser authentication', function ()
{
  this.timeout(5000);
  var webbrowser;
  var httpclient;

  var mockProofKey = 'mockProofKey';
  var mockToken = 'mockToken';

  before(function ()
  {
    mock('webbrowser', {
      open: function (url)
      {
        var client = net.createConnection({ port: url }, () =>
        {
          client.write(`GET /?token=${mockToken} HTTP/1.1\r\n`);
        });
        return;
      }
    });
    mock('httpclient', {
      post: async function (url, body, header)
      {
        var data =
        {
          data: {
            data:
            {
              ssoUrl: body['data']['BROWSER_MODE_REDIRECT_PORT'],
              proofKey: mockProofKey
            }
          }
        }
        return data;
      }
    });

    webbrowser = require('webbrowser');
    httpclient = require('httpclient');
  });

  // Skipped - requires manual interaction to enter credentials on browser
  it.skip('external browser', function (done)
  {
    var connection = snowflake.createConnection(externalConnectionConfig[0].options);
    var ret = connection.connectAsync(function (err, conn)
    {
      done(err);
    }).then(() =>
    {
      assert.strictEqual(
        connection, ret, 'connect() should return the connection');
    });
  });

  it('external browser - get success', async function ()
  {
    var credentials = externalConnectionConfig[0].options;

    var auth = new auth_web('', '', webbrowser.open, httpclient);
    await auth.authenticate(credentials.authenticator, '', credentials.account, credentials.username);

    var body = { data: {} };
    auth.updateBody(body);

    assert.strictEqual(body['data']['TOKEN'], mockToken);
    assert.strictEqual(body['data']['PROOF_KEY'], mockProofKey);
  });

  it('external browser - get fail', async function ()
  {
    mock('webbrowser', {
      open: function (url)
      {
        var client = net.createConnection({ port: url }, () =>
        {
          client.write(`\r\n`);
        });
        return;
      }
    });
    mock('httpclient', {
      post: async function (url, body, header)
      {
        var data =
        {
          data: {
            data:
            {
              ssoUrl: body['data']['BROWSER_MODE_REDIRECT_PORT']
            }
          }
        }
        return data;
      }
    });

    webbrowser = require('webbrowser');
    httpclient = require('httpclient');

    var credentials = externalConnectionConfig[0].options;

    var auth = new auth_web('', '', webbrowser.open, httpclient);
    await auth.authenticate(credentials.authenticator, '', credentials.account, credentials.username);

    var body = { data: {} };
    auth.updateBody(body);

    assert.strictEqual(typeof body['data']['TOKEN'], 'undefined');
    assert.strictEqual(typeof body['data']['PROOF_KEY'], 'undefined');
  });
});
