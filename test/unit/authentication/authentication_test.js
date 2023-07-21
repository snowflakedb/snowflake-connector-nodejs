/*
 * Copyright (c) 2021 Snowflake Computing Inc. All rights reserved.
 */

var assert = require('assert');
var mock = require('mock-require');
var net = require('net');

var authenticator = require('./../../../lib/authentication/authentication');
var auth_default = require('./../../../lib/authentication/auth_default');
var auth_web = require('./../../../lib/authentication/auth_web');
var auth_keypair = require('./../../../lib/authentication/auth_keypair');
var auth_oauth = require('./../../../lib/authentication/auth_oauth');
var auth_okta = require('./../../../lib/authentication/auth_okta');
var authenticationTypes = require('./../../../lib/authentication/authentication').authenticationTypes;

var MockTestUtil = require('./../mock/mock_test_util');

// get connection options to connect to this mock snowflake instance
var mockConnectionOptions = MockTestUtil.connectionOptions;
var connectionOptions = mockConnectionOptions.default;
var connectionOptionsDefault = mockConnectionOptions.authDefault;
var connectionOptionsExternalBrowser = mockConnectionOptions.authExternalBrowser;
var connectionOptionsKeyPair = mockConnectionOptions.authKeyPair;
var connectionOptionsKeyPairPath = mockConnectionOptions.authKeyPairPath;
var connectionOptionsOauth = mockConnectionOptions.authOauth;
var connectionOptionsOkta = mockConnectionOptions.authOkta;

describe('default authentication', function ()
{

  it('default - authenticate method is thenable', done =>
  {
    const auth = new auth_default(connectionOptions.password);

    auth.authenticate()
      .then(done)
      .catch(done);
  });

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
  var browserRedirectPort;

  const mockProofKey = 'mockProofKey';
  const mockToken = 'mockToken';
  const mockSsoURL = 'https://ssoTestURL.okta.com/';

  const credentials = connectionOptionsExternalBrowser;
  const BROWSER_ACTION_TIMEOUT = 10000;

  before(function ()
  {
    mock('webbrowser', {
      open: function (url)
      {
        var client = net.createConnection({ port: browserRedirectPort }, () =>
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
              ssoUrl: mockSsoURL,
              proofKey: mockProofKey
            }
          }
        }
        browserRedirectPort = body['data']['BROWSER_MODE_REDIRECT_PORT'];
        return data;
      }
    });

    webbrowser = require('webbrowser');
    httpclient = require('httpclient');
  });

  it('external browser - authenticate method is thenable', done =>
  {
    const auth = new auth_web('', BROWSER_ACTION_TIMEOUT, webbrowser.open, httpclient);

    auth.authenticate(credentials.authenticator, '', credentials.account, credentials.username)
      .then(done)
      .catch(done);
  });

  it('external browser - get success', async function ()
  {
    const auth = new auth_web('', BROWSER_ACTION_TIMEOUT, webbrowser.open, httpclient);
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
        var client = net.createConnection({ port: browserRedirectPort }, () =>
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
              ssoUrl: mockSsoURL
            }
          }
        }
        browserRedirectPort = body['data']['BROWSER_MODE_REDIRECT_PORT'];
        return data;
      }
    });

    webbrowser = require('webbrowser');
    httpclient = require('httpclient');

    const auth = new auth_web('', BROWSER_ACTION_TIMEOUT, webbrowser.open, httpclient);
    await auth.authenticate(credentials.authenticator, '', credentials.account, credentials.username);

    var body = { data: {} };
    auth.updateBody(body);

    assert.strictEqual(typeof body['data']['TOKEN'], 'undefined');
    assert.strictEqual(typeof body['data']['PROOF_KEY'], 'undefined');
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
});

describe('key-pair authentication', function ()
{
  var cryptomod;
  var jwtmod;
  var filesystem;

  var mockToken = 'mockToken';
  var mockPrivateKeyFile = 'mockPrivateKeyFile';
  var mockPublicKeyObj = 'mockPublicKeyObj';

  before(function ()
  {
    mock('cryptomod', {
      createPrivateKey: function (options)
      {
        assert.strictEqual(options.key, mockPrivateKeyFile);

        if (options.passphrase)
        {
          assert.strictEqual(options.passphrase, connectionOptionsKeyPairPath.privateKeyPass);
        }

        function privKeyObject()
        {
          this.export = function ()
          {
            return connectionOptionsKeyPair.privateKey;
          }
        }

        return new privKeyObject;
      },
      createPublicKey: function (options)
      {
        assert.strictEqual(options.key, connectionOptionsKeyPair.privateKey);

        function pubKeyObject()
        {
          this.export = function ()
          {
            return mockPublicKeyObj;
          }
        }

        return new pubKeyObject;
      },
      createHash: function ()
      {
        function createHash()
        {
          this.update = function (publicKeyObj)
          {
            function update()
            {
              assert.strictEqual(publicKeyObj, mockPublicKeyObj);
              this.digest = function () {}
            }
            return new update;
          }
        }
        return new createHash;
      }
    });
    mock('jwtmod', {
      sign: function (payload, privateKey, algorithm)
      {
        return mockToken;
      }
    });
    mock('filesystem', {
      readFileSync: function (path)
      {
        return mockPrivateKeyFile;
      }
    });

    cryptomod = require('cryptomod');
    jwtmod = require('jwtmod');
    filesystem = require('filesystem');
  });

  it('key-pair - authenticate method is thenable', done =>
  {
    const auth = new auth_keypair(connectionOptionsKeyPair.privateKey,
      connectionOptionsKeyPair.privateKeyPath,
      connectionOptionsKeyPair.privateKeyPass,
      cryptomod, jwtmod, filesystem);

    auth.authenticate(connectionOptionsKeyPair.authenticator, '', connectionOptionsKeyPair.account, connectionOptionsKeyPair.username)
      .then(done)
      .catch(done);
  });

  it('key-pair - get token with private key', function ()
  {
    var auth = new auth_keypair(connectionOptionsKeyPair.privateKey,
      connectionOptionsKeyPair.privateKeyPath,
      connectionOptionsKeyPair.privateKeyPass,
      cryptomod, jwtmod, filesystem);

    auth.authenticate(connectionOptionsKeyPair.authenticator, '', connectionOptionsKeyPair.account, connectionOptionsKeyPair.username);

    var body = { data: {} };
    auth.updateBody(body);

    assert.strictEqual(
      body['data']['TOKEN'], mockToken, 'Token should be equal');
  });

  it('key-pair - get token with private key path with passphrase', function ()
  {
    var auth = new auth_keypair(connectionOptionsKeyPairPath.privateKey,
      connectionOptionsKeyPairPath.privateKeyPath,
      connectionOptionsKeyPairPath.privateKeyPass,
      cryptomod, jwtmod, filesystem);

    auth.authenticate(connectionOptionsKeyPairPath.authenticator, '',
      connectionOptionsKeyPairPath.account,
      connectionOptionsKeyPairPath.username);

    var body = { data: {} };
    auth.updateBody(body);

    assert.strictEqual(
      body['data']['TOKEN'], mockToken, 'Token should be equal');
  });

  it('key-pair - get token with private key path without passphrase', function ()
  {
    var auth = new auth_keypair(connectionOptionsKeyPairPath.privateKey,
      connectionOptionsKeyPairPath.privateKeyPath,
      '',
      cryptomod, jwtmod, filesystem);

    auth.authenticate(connectionOptionsKeyPairPath.authenticator, '',
      connectionOptionsKeyPairPath.account,
      connectionOptionsKeyPairPath.username);

    var body = { data: {} };
    auth.updateBody(body);

    assert.strictEqual(
      body['data']['TOKEN'], mockToken, 'Token should be equal');
  });

  it('key-pair - check authenticator', function ()
  {
    var body = authenticator.formAuthJSON(connectionOptionsKeyPair.authenticator,
      connectionOptionsKeyPair.account,
      connectionOptionsKeyPair.username,
      {}, {}, {});

    assert.strictEqual(
      body['data']['AUTHENTICATOR'], authenticationTypes.KEY_PAIR_AUTHENTICATOR, 'Authenticator should be SNOWFLAKE_JWT');
  });
});

describe('oauth authentication', function ()
{
  it('oauth - authenticate method is thenable', done =>
  {
    const auth = new auth_oauth(connectionOptionsOauth.token);

    auth.authenticate(connectionOptionsKeyPair.authenticator, '', connectionOptionsKeyPair.account, connectionOptionsKeyPair.username)
      .then(done)
      .catch(done);
  });

  it('oauth - check token', function ()
  {
    var auth = new auth_oauth(connectionOptionsOauth.token);

    var body = { data: {} };
    auth.updateBody(body);

    assert.strictEqual(
      body['data']['TOKEN'], connectionOptionsOauth.token, 'Token should be equal');
  });

  it('oauth - check authenticator', function ()
  {
    var body = authenticator.formAuthJSON(connectionOptionsOauth.authenticator,
      connectionOptionsOauth.account,
      connectionOptionsOauth.username,
      {}, {}, {});

    assert.strictEqual(
      body['data']['AUTHENTICATOR'], authenticationTypes.OAUTH_AUTHENTICATOR, 'Authenticator should be OAUTH');
  });
});

describe('okta authentication', function ()
{
  var httpclient;

  var mockssoUrl = connectionOptionsOkta.authenticator;
  var mockTokenUrl = connectionOptionsOkta.authenticator;
  var mockCookieToken = 'mockCookieToken';
  var mockUrl = 'mockUrl';

  var mockSamlResponse = '<form action="https://' + connectionOptionsOkta.account + '.snowflakecomputing.com/fed/login">';

  before(function ()
  {
    mock('httpclient', {
      post: async function (url, body, header)
      {
        var json;
        if (url.startsWith('https://' + connectionOptionsOkta.account))
        {
          json =
          {
            data: {
              data:
              {
                ssoUrl: mockssoUrl,
                tokenUrl: mockTokenUrl
              }
            }
          }
        }
        if (url === mockTokenUrl)
        {
          json =
          {
            data: mockCookieToken
          }
        }
        return json;
      },
      get: async function (url, body, header)
      {
        var json =
        {
          data: mockSamlResponse
        }
        return json;
      }
    });

    httpclient = require('httpclient');
  });

  it('okta - authenticate method is thenable', done =>
  {
    const auth = new auth_okta(connectionOptionsOkta.password,
      connectionOptionsOkta.region,
      connectionOptionsOkta.account,
      connectionOptionsOkta.clientAppid,
      connectionOptionsOkta.clientAppVersion,
      httpclient);

    auth.authenticate(connectionOptionsOkta.authenticator, '', connectionOptionsOkta.account, connectionOptionsOkta.username)
      .then(done)
      .catch(done);
  })

  it('okta - SAML response success', async function ()
  {
    var auth = new auth_okta(connectionOptionsOkta.password,
      connectionOptionsOkta.region,
      connectionOptionsOkta.account,
      connectionOptionsOkta.clientAppid,
      connectionOptionsOkta.clientAppVersion,
      httpclient);

    await auth.authenticate(connectionOptionsOkta.authenticator, '', connectionOptionsOkta.account, connectionOptionsOkta.username);

    var body = { data: {} };
    auth.updateBody(body);

    assert.strictEqual(
      body['data']['RAW_SAML_RESPONSE'], connectionOptionsOkta.rawSamlResponse, 'SAML response should be equal');
  });

  it('okta - SAML response fail prefix', async function ()
  {
    mock('httpclient', {
      post: async function (url, body, header)
      {
        var json;
        if (url.startsWith('https://' + connectionOptionsOkta.account))
        {
          json =
          {
            data: {
              data:
              {
                ssoUrl: mockssoUrl,
                tokenUrl: 'abcd'
              }
            }
          }
        }
        return json;
      }
    });

    httpclient = require('httpclient');

    var auth = new auth_okta(connectionOptionsOkta.password,
      connectionOptionsOkta.region,
      connectionOptionsOkta.account,
      connectionOptionsOkta.clientAppid,
      connectionOptionsOkta.clientAppVersion,
      httpclient);

    try
    {
      await auth.authenticate(connectionOptionsOkta.authenticator, '', connectionOptionsOkta.account, connectionOptionsOkta.username);
    }
    catch (err)
    {
      assert.strictEqual(err.message, "The prefix of the SSO/token URL and the specified authenticator do not match.");
    }
  });

  it('okta - SAML response fail postback', async function ()
  {
    mock('httpclient', {
      post: async function (url, body, header)
      {
        var json;
        if (url.startsWith('https://' + connectionOptionsOkta.account))
        {
          json =
          {
            data: {
              data:
              {
                ssoUrl: mockssoUrl,
                tokenUrl: mockTokenUrl
              }
            }
          }
        }
        if (url === mockTokenUrl)
        {
          json =
          {
            data: mockCookieToken
          }
        }
        return json;
      },
      get: async function (url, body, header)
      {
        var json =
        {
          data: mockUrl
        }
        return json;
      }
    });

    httpclient = require('httpclient');

    var auth = new auth_okta(connectionOptionsOkta.password,
      connectionOptionsOkta.region,
      connectionOptionsOkta.account,
      connectionOptionsOkta.clientAppid,
      connectionOptionsOkta.clientAppVersion,
      httpclient);

    try
    {
      await auth.authenticate(connectionOptionsOkta.authenticator, '', connectionOptionsOkta.account, connectionOptionsOkta.username);
    }
    catch (err)
    {
      assert.strictEqual(err.message,
        "The specified authenticator and destination URL in the SAML assertion do not match: expected: https://" +
        connectionOptionsOkta.account + ".snowflakecomputing.com:443 postback: " + mockUrl);
    }
  });

  it('okta - check authenticator', function ()
  {
    var body = authenticator.formAuthJSON(connectionOptionsOkta.authenticator,
      connectionOptionsOkta.account,
      connectionOptionsOkta.username,
      {}, {}, {});

    assert.strictEqual(
      body['data']['AUTHENTICATOR'], 'https://dev-12345678.okta.com/' , 'Authenticator should be OAUTH');
  });
});
