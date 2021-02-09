/*
 * Copyright (c) 2021 Snowflake Computing Inc. All rights reserved.
 */

var snowflake = require('./../../../lib/snowflake');

var assert = require('assert');
var mock = require('mock-require');
var net = require('net');

var authenticator = require('./../../../lib/authentication/authentication');
var auth_default = require('./../../../lib/authentication/auth_default');
var auth_web = require('./../../../lib/authentication/auth_web');
var authenticationTypes = require('./../../../lib/authentication/authentication').authenticationTypes;

var MockTestUtil = require('./../mock/mock_test_util');
var assert = require('assert');

// get a mock snowflake instance
var snowflake = MockTestUtil.snowflake;

// get connection options to connect to this mock snowflake instance
var mockConnectionOptions = MockTestUtil.connectionOptions;
var connectionOptions = mockConnectionOptions.default;
var connectionOptionsDefault = mockConnectionOptions.authenticatorDefault;
var connectionOptionsExternalBrowser = mockConnectionOptions.authenticatorExternalBrowser;

describe('default authentication', function ()
{
  it('default - check password', function ()
  {
    var auth = new auth_default(connectionOptions.password);

    var body = { data: {} };
    auth.updateBody(body);

    assert.strictEqual(
      body['data']['PASSWORD'], connectionOptions.password, 'Password should be equal');
  });

  it('default - check authenticator', function ()
  {
    var body = authenticator.formAuthJSON(connectionOptionsDefault.authenticator,
      connectionOptionsDefault.account,
      connectionOptionsDefault.username,
      {}, {}, {});

    assert.strictEqual(
      body['data']['AUTHENTICATOR'], authenticationTypes.DEFAULT_AUTHENTICATOR, 'Authenticator should be SNOWFLAKE');
  });
});

describe('external browser authentication', function ()
{
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

  it('external browser - check authenticator', function ()
  {
    var body = authenticator.formAuthJSON(connectionOptionsExternalBrowser.authenticator,
      connectionOptionsExternalBrowser.account,
      connectionOptionsExternalBrowser.username,
      {}, {}, {});

    assert.strictEqual(
      body['data']['AUTHENTICATOR'], authenticationTypes.EXTERNAL_BROWSER_AUTHENTICATOR, 'Authenticator should be EXTERNALBROWSER');
  });

  it('external browser - get success', async function ()
  {
    var credentials = connectionOptionsExternalBrowser;

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

    var credentials = connectionOptionsExternalBrowser;

    var auth = new auth_web('', '', webbrowser.open, httpclient);
    await auth.authenticate(credentials.authenticator, '', credentials.account, credentials.username);

    var body = { data: {} };
    auth.updateBody(body);

    assert.strictEqual(typeof body['data']['TOKEN'], 'undefined');
    assert.strictEqual(typeof body['data']['PROOF_KEY'], 'undefined');
  });
});
