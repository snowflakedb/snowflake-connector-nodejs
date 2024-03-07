/*
 * Copyright (c) 2021 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const mock = require('mock-require');
const net = require('net');

const authenticator = require('./../../../lib/authentication/authentication');
const AuthDefault = require('./../../../lib/authentication/auth_default');
const AuthWeb = require('./../../../lib/authentication/auth_web');
const AuthKeypair = require('./../../../lib/authentication/auth_keypair');
const AuthOauth = require('./../../../lib/authentication/auth_oauth');
const AuthOkta = require('./../../../lib/authentication/auth_okta');
const authenticationTypes = require('./../../../lib/authentication/authentication').authenticationTypes;

const MockTestUtil = require('./../mock/mock_test_util');
const Util = require("../../../lib/util");

// get connection options to connect to this mock snowflake instance
const mockConnectionOptions = MockTestUtil.connectionOptions;
const connectionOptions = mockConnectionOptions.default;
const connectionOptionsDefault = mockConnectionOptions.authDefault;
const connectionOptionsExternalBrowser = mockConnectionOptions.authExternalBrowser;
const connectionOptionsKeyPair = mockConnectionOptions.authKeyPair;
const connectionOptionsKeyPairPath = mockConnectionOptions.authKeyPairPath;
const connectionOptionsOauth = mockConnectionOptions.authOauth;
const connectionOptionsOkta = mockConnectionOptions.authOkta;

describe('default authentication', function () {

  it('default - authenticate method is thenable', done => {
    const auth = new AuthDefault(connectionOptions.password);

    auth.authenticate()
      .then(done)
      .catch(done);
  });

  it('default - check password', function () {
    const auth = new AuthDefault(connectionOptions.password);

    const body = { data: {} };
    auth.updateBody(body);

    assert.strictEqual(
      body['data']['PASSWORD'], connectionOptions.password, 'Password should be equal');
  });

  it('default - check authenticator', function () {
    const body = authenticator.formAuthJSON(connectionOptionsDefault.authenticator,
      connectionOptionsDefault.account,
      connectionOptionsDefault.username,
      {}, {}, {});

    assert.strictEqual(
      body['data']['AUTHENTICATOR'], authenticationTypes.DEFAULT_AUTHENTICATOR, 'Authenticator should be SNOWFLAKE');
  });
});

describe('external browser authentication', function () {
  let webbrowser;
  let browserRedirectPort;
  let httpclient;

  const mockProofKey = 'mockProofKey';
  const mockToken = 'mockToken';
  const mockSsoURL = 'https://ssoTestURL.okta.com/';

  const credentials = connectionOptionsExternalBrowser;
  const BROWSER_ACTION_TIMEOUT = 10000;
  const connectionConfig = {
    getBrowserActionTimeout: () => BROWSER_ACTION_TIMEOUT,
    getProxy: () => {},
    getAuthenticator: () => credentials.authenticator,
    getServiceName: () => '',
    getDisableConsoleLogin: () => true,
    host: 'fakehost'
  };

  before(function () {
    mock('webbrowser', {
      open: function () {
        const client = net.createConnection({ port: browserRedirectPort }, () => {
          client.write(`GET /?token=${mockToken} HTTP/1.1\r\n`);
        });
        return;
      }
    });
    mock('httpclient', {
      requestAsync: async function (options) {
        const data =
          {
            data: {
              data:
                {
                  ssoUrl: mockSsoURL,
                  proofKey: mockProofKey
                }
            }
          };
        browserRedirectPort = options.data['data']['BROWSER_MODE_REDIRECT_PORT'];
        return data;
      }
    });

    webbrowser = require('webbrowser');
    httpclient = require('httpclient');
  });

  it('external browser - authenticate method is thenable', done => {
    const auth = new AuthWeb(connectionConfig, httpclient, webbrowser.open);

    auth.authenticate(credentials.authenticator, '', credentials.account, credentials.username, credentials.host)
      .then(done)
      .catch(done);
  });

  it('external browser - get success', async function () {
    const auth = new AuthWeb(connectionConfig, httpclient, webbrowser.open);
    await auth.authenticate(credentials.authenticator, '', credentials.account, credentials.username, credentials.host);

    const body = { data: {} };
    auth.updateBody(body);

    assert.strictEqual(body['data']['TOKEN'], mockToken);
    assert.strictEqual(body['data']['PROOF_KEY'], mockProofKey);
  });

  it('external browser - get fail', async function () {
    mock('webbrowser', {
      open: function () {
        const client = net.createConnection({ port: browserRedirectPort }, () => {
          client.write('\r\n');
        });
        return;
      }
    });

    mock('httpclient', {
      requestAsync: async function (options) {
        const data =
          {
            data: {
              data:
                {
                  ssoUrl: mockSsoURL
                }
            }
          };
        browserRedirectPort = options.data['data']['BROWSER_MODE_REDIRECT_PORT'];
        return data;
      }
    });

    webbrowser = require('webbrowser');
    httpclient = require('httpclient');

    const auth = new AuthWeb(connectionConfig, httpclient, webbrowser.open);
    await auth.authenticate(credentials.authenticator, '', credentials.account, credentials.username, credentials.host);

    const body = { data: {} };
    auth.updateBody(body);

    assert.strictEqual(typeof body['data']['TOKEN'], 'undefined');
    assert.strictEqual(typeof body['data']['PROOF_KEY'], 'undefined');
  });

  it('external browser - check authenticator', function () {
    const body = authenticator.formAuthJSON(connectionOptionsExternalBrowser.authenticator,
      connectionOptionsExternalBrowser.account,
      connectionOptionsExternalBrowser.username,
      {}, {}, {});

    assert.strictEqual(
      body['data']['AUTHENTICATOR'], authenticationTypes.EXTERNAL_BROWSER_AUTHENTICATOR, 'Authenticator should be EXTERNALBROWSER');
  });
});

describe('key-pair authentication', function () {
  let cryptomod;
  let jwtmod;
  let filesystem;

  const mockToken = 'mockToken';
  const mockPrivateKeyFile = 'mockPrivateKeyFile';
  const mockPublicKeyObj = 'mockPublicKeyObj';

  before(function () {
    mock('cryptomod', {
      createPrivateKey: function (options) {
        assert.strictEqual(options.key, mockPrivateKeyFile);

        if (options.passphrase) {
          assert.strictEqual(options.passphrase, connectionOptionsKeyPairPath.privateKeyPass);
        }

        function privKeyObject() {
          this.export = function () {
            return connectionOptionsKeyPair.privateKey;
          };
        }

        return new privKeyObject;
      },
      createPublicKey: function (options) {
        assert.strictEqual(options.key, connectionOptionsKeyPair.privateKey);

        function pubKeyObject() {
          this.export = function () {
            return mockPublicKeyObj;
          };
        }

        return new pubKeyObject;
      },
      createHash: function () {
        function createHash() {
          this.update = function (publicKeyObj) {
            function update() {
              assert.strictEqual(publicKeyObj, mockPublicKeyObj);
              this.digest = function () {};
            }
            return new update;
          };
        }
        return new createHash;
      }
    });
    mock('jwtmod', {
      sign: function () {
        return mockToken;
      }
    });
    mock('filesystem', {
      readFileSync: function () {
        return mockPrivateKeyFile;
      }
    });

    cryptomod = require('cryptomod');
    jwtmod = require('jwtmod');
    filesystem = require('filesystem');
  });

  it('key-pair - authenticate method is thenable', done => {
    const auth = new AuthKeypair(connectionOptionsKeyPair.privateKey,
      connectionOptionsKeyPair.privateKeyPath,
      connectionOptionsKeyPair.privateKeyPass,
      cryptomod, jwtmod, filesystem);

    auth.authenticate(connectionOptionsKeyPair.authenticator, '', connectionOptionsKeyPair.account, connectionOptionsKeyPair.username)
      .then(done)
      .catch(done);
  });

  it('key-pair - get token with private key', function () {
    const auth = new AuthKeypair(connectionOptionsKeyPair.privateKey,
      connectionOptionsKeyPair.privateKeyPath,
      connectionOptionsKeyPair.privateKeyPass,
      cryptomod, jwtmod, filesystem);

    auth.authenticate(connectionOptionsKeyPair.authenticator, '', connectionOptionsKeyPair.account, connectionOptionsKeyPair.username);

    const body = { data: {} };
    auth.updateBody(body);

    assert.strictEqual(
      body['data']['TOKEN'], mockToken, 'Token should be equal');
  });

  it('key-pair - get token with private key path with passphrase', function () {
    const auth = new AuthKeypair(connectionOptionsKeyPairPath.privateKey,
      connectionOptionsKeyPairPath.privateKeyPath,
      connectionOptionsKeyPairPath.privateKeyPass,
      cryptomod, jwtmod, filesystem);

    auth.authenticate(connectionOptionsKeyPairPath.authenticator, '',
      connectionOptionsKeyPairPath.account,
      connectionOptionsKeyPairPath.username);

    const body = { data: {} };
    auth.updateBody(body);

    assert.strictEqual(
      body['data']['TOKEN'], mockToken, 'Token should be equal');
  });

  it('key-pair - get token with private key path without passphrase', function () {
    const auth = new AuthKeypair(connectionOptionsKeyPairPath.privateKey,
      connectionOptionsKeyPairPath.privateKeyPath,
      '',
      cryptomod, jwtmod, filesystem);

    auth.authenticate(connectionOptionsKeyPairPath.authenticator, '',
      connectionOptionsKeyPairPath.account,
      connectionOptionsKeyPairPath.username);

    const body = { data: {} };
    auth.updateBody(body);

    assert.strictEqual(
      body['data']['TOKEN'], mockToken, 'Token should be equal');
  });

  it('key-pair - check authenticator', function () {
    const body = authenticator.formAuthJSON(connectionOptionsKeyPair.authenticator,
      connectionOptionsKeyPair.account,
      connectionOptionsKeyPair.username,
      {}, {}, {});

    assert.strictEqual(
      body['data']['AUTHENTICATOR'], authenticationTypes.KEY_PAIR_AUTHENTICATOR, 'Authenticator should be SNOWFLAKE_JWT');
  });
});

describe('oauth authentication', function () {
  it('oauth - authenticate method is thenable', done => {
    const auth = new AuthOauth(connectionOptionsOauth.token);

    auth.authenticate(connectionOptionsKeyPair.authenticator, '', connectionOptionsKeyPair.account, connectionOptionsKeyPair.username)
      .then(done)
      .catch(done);
  });

  it('oauth - check token', function () {
    const auth = new AuthOauth(connectionOptionsOauth.token);

    const body = { data: {} };
    auth.updateBody(body);

    assert.strictEqual(
      body['data']['TOKEN'], connectionOptionsOauth.token, 'Token should be equal');
  });

  it('oauth - check authenticator', function () {
    const body = authenticator.formAuthJSON(connectionOptionsOauth.authenticator,
      connectionOptionsOauth.account,
      connectionOptionsOauth.username,
      {}, {}, {});

    assert.strictEqual(
      body['data']['AUTHENTICATOR'], authenticationTypes.OAUTH_AUTHENTICATOR, 'Authenticator should be OAUTH');
  });
});

describe('okta authentication', function () {
  let httpclient;

  const mockssoUrl = connectionOptionsOkta.authenticator;
  const mockTokenUrl = connectionOptionsOkta.authenticator;
  const mockCookieToken = 'mockCookieToken';
  const mockUrl = 'mockUrl';

  const mockSamlResponse = '<form action="https://' + connectionOptionsOkta.account + '.snowflakecomputing.com/fed/login">';

  before(function () {
    mock('httpclient', {
      post: async function (url) {
        let json;
        if (url.startsWith('https://' + connectionOptionsOkta.account)) {
          json =
          {
            data: {
              success: true,
              data: {
                ssoUrl: mockssoUrl,
                tokenUrl: mockTokenUrl
              }
            }
          };
        }
        if (url === mockTokenUrl) {
          json =
          {
            data: mockCookieToken
          };
        }
        return json;
      },
      get: async function () {
        const json =
        {
          data: mockSamlResponse
        };
        return json;
      }
    });

    httpclient = require('httpclient');
  });

  it('okta - authenticate method is thenable', done => {
    const auth = new AuthOkta(connectionOptionsOkta, httpclient);

    auth.authenticate(connectionOptionsOkta.authenticator, '', connectionOptionsOkta.account, connectionOptionsOkta.username)
      .then(done)
      .catch(done);
  });

  it('okta - SAML response success', async function () {
    const auth = new AuthOkta(connectionOptionsOkta, httpclient);

    await auth.authenticate(connectionOptionsOkta.authenticator, '', connectionOptionsOkta.account, connectionOptionsOkta.username);

    const body = { data: {} };
    auth.updateBody(body);

    assert.strictEqual(
      body['data']['RAW_SAML_RESPONSE'], connectionOptionsOkta.rawSamlResponse, 'SAML response should be equal');
  });

  it('okta - reauthenticate', async function () {
    const auth = authenticator.getAuthenticator(connectionOptionsOkta, httpclient);
    await auth.authenticate(connectionOptionsOkta.authenticator, '', connectionOptionsOkta.account, connectionOptionsOkta.username);
    const body = { 
      data: {
        RAW_SAML_RESPONSE: 'WRONG SAML'
      } 
    };
    const sameAuth = authenticator.getCurrentAuth();
    assert.strictEqual(auth, sameAuth);

    sameAuth.reauthenticate(body, {
      totalElapsedTime: 120,
      numRetries: 2,
    }).then(() => {
      assert.strictEqual(
        body['data']['RAW_SAML_RESPONSE'], connectionOptionsOkta.rawSamlResponse, 'SAML response should be equal');
    });
  });

  it('okta - reauthentication timeout error', async function () {
    const auth = authenticator.getAuthenticator(connectionOptionsOkta, httpclient);
    await auth.authenticate(connectionOptionsOkta.authenticator, '', connectionOptionsOkta.account, connectionOptionsOkta.username);
    
    try {
      await auth.reauthenticate({ data: { RAW_SAML_RESPONSE: 'token' } }, { numRetries: 5, totalElapsedTime: 350 });
      assert.fail();
    } catch (err) {
      assert.strictEqual('Reached out to the Login Timeout', err.message);
    }
  });

  it('okta - reauthentication max retry error', async function () {
    const auth = authenticator.getAuthenticator(connectionOptionsOkta, httpclient);
    await auth.authenticate(connectionOptionsOkta.authenticator, '', connectionOptionsOkta.account, connectionOptionsOkta.username);
    
    try {
      await auth.reauthenticate({ data: { RAW_SAML_RESPONSE: 'token' } }, { numRetries: 9, totalElapsedTime: 280 });
      assert.fail();
    } catch (err) {
      assert.strictEqual('Reached out to the max retry count', err.message);
    }
  });

  it('okta - SAML response fail prefix', async function () {
    mock('httpclient', {
      post: async function (url) {
        let json;
        if (url.startsWith('https://' + connectionOptionsOkta.account)) {
          json =
          {
            data: {
              success: true,
              data:
              {
                ssoUrl: mockssoUrl,
                tokenUrl: 'abcd'
              }
            }
          };
        }
        return json;
      }
    });

    httpclient = require('httpclient');

    const auth = new AuthOkta(connectionOptionsOkta, httpclient);

    try {
      await auth.authenticate(connectionOptionsOkta.authenticator, '', connectionOptionsOkta.account, connectionOptionsOkta.username);
    } catch (err) {
      assert.strictEqual(err.message, 'The prefix of the SSO/token URL and the specified authenticator do not match.');
    }
  });

  it('okta - SAML response fail postback', async function () {
    mock('httpclient', {
      post: async function (url) {
        let json;
        if (url.startsWith('https://' + connectionOptionsOkta.account)) {
          json =
          {
            data: {
              success: true,
              data:
              {
                ssoUrl: mockssoUrl,
                tokenUrl: mockTokenUrl
              }
            }
          };
        }
        if (url === mockTokenUrl) {
          json =
          {
            data: mockCookieToken
          };
        }
        return json;
      },
      get: async function () {
        const json =
        {
          data: mockUrl
        };
        return json;
      }
    });

    httpclient = require('httpclient');

    const auth = new AuthOkta(connectionOptionsOkta, httpclient);

    try {
      await auth.authenticate(connectionOptionsOkta.authenticator, '', connectionOptionsOkta.account, connectionOptionsOkta.username);
    } catch (err) {
      assert.strictEqual(err.message,
        'The specified authenticator and destination URL in the SAML assertion do not match: expected: https://' +
        connectionOptionsOkta.account + '.snowflakecomputing.com:443 postback: ' + mockUrl);
    }
  });

  it('okta - no authenticator should be added to the request body', function () {
    const body = authenticator.formAuthJSON(connectionOptionsOkta.authenticator,
      connectionOptionsOkta.account,
      connectionOptionsOkta.username,
      {}, {}, {});

    assert.strictEqual(
      body['data']['AUTHENTICATOR'], undefined, 'No authenticator should be present');
  });

  describe('validateURLs test for Native Okta SSO - prefix must match', () => {
    // original function is private
    function mockValidateURLs(authenticator, ssoUrl, tokenUrl) {
      const a_URL = new URL(authenticator.toLowerCase());
      const s_URL = new URL(ssoUrl.toLowerCase());
      const t_URL = new URL(tokenUrl.toLowerCase());

      return (!(a_URL.protocol + '//' + a_URL.host == s_URL.protocol + '//' + s_URL.host &&
          a_URL.protocol + '//' + a_URL.host == t_URL.protocol + '//' + t_URL.host))
    }
    // positive cases
    [
      { name: '.okta.com format, ssourl and tokenurl matches', authenticator: 'https://mycustom.okta.com', ssourl: 'https://mycustom.okta.com/app/snowflake/mytokenmytokenmytoken',
        tokenurl: 'https://mycustom.okta.com/api/v1/sessions' },
      { name: 'custom okta format, ssourl and tokenurl matches', authenticator: 'HTTPS://MYAPPS.MYDOMAIN.COM/SNOWFLAKE/OKTA', ssourl: 'https://MYAPPS.MYDOMAIN.COM/app/snowflake/mytokenmytoken/sso/saml',
        tokenurl: 'https://MYAPPS.MYDOMAIN.COM/api/v1/authn' },
      { name: '.okta.com format with default https port, ssourl (no port) and tokenurl matches', authenticator: 'https://mycustom.okta.com:443', ssourl: 'https://mycustom.okta.com/app/snowflake/mytokenmytokenmytoken',
        tokenurl: 'https://mycustom.okta.com/api/v1/sessions' },
      { name: 'custom okta format with default https port, ssourl and tokenurl matches', authenticator: 'HTTPS://MYAPPS.MYDOMAIN.COM:443/SNOWFLAKE/OKTA', ssourl: 'https://MYAPPS.MYDOMAIN.COM:443/app/snowflake/mytokenmytoken/sso/saml',
        tokenurl: 'https://MYAPPS.MYDOMAIN.COM/api/v1/authn' },
      { name: '.okta.com format with custom https port, ssourl and tokenurl matches', authenticator: 'https://mycustom.okta.com:8443', ssourl: 'https://mycustom.okta.com:8443/app/snowflake/mytokenmytokenmytoken',
        tokenurl: 'https://mycustom.okta.com:8443/api/v1/sessions' },
      { name: 'custom okta format with custom https port, ssourl and tokenurl matches', authenticator: 'HTTPS://MYAPPS.MYDOMAIN.COM:8443/SNOWFLAKE/OKTA', ssourl: 'https://MYAPPS.MYDOMAIN.COM:8443/app/snowflake/mytokenmytoken/sso/saml',
        tokenurl: 'https://MYAPPS.MYDOMAIN.COM:8443/api/v1/authn' }
    ].forEach(({ name, authenticator, ssourl, tokenurl }) => {
      it(`${name}`, () => {
        assert.equal(mockValidateURLs(authenticator, ssourl, tokenurl), false);
      });
    });
    // negative cases
    [
      { name: '.okta.com format, ssourl doesnt match', authenticator: 'https://mycustom.okta.com', ssourl: 'https://another.okta.com/app/snowflake/mytokenmytokenmytoken',
        tokenurl: 'https://mycustom.okta.com/api/v1/sessions',  },
      { name: 'custom okta format, ssourl doesnt match', authenticator: 'HTTPS://MYAPPS.MYDOMAIN.COM/SNOWFLAKE/OKTA', ssourl: 'https://MYAPPS.MYDOMAIN.NET/app/snowflake/mytokenmytoken/sso/saml',
        tokenurl: 'https://MYAPPS.MYDOMAIN.COM/api/v1/authn' },
      { name: '.okta.com format, protocol doesnt match', authenticator: 'https://mycustom.okta.com', ssourl: 'http://another.okta.com/app/snowflake/mytokenmytokenmytoken',
        tokenurl: 'http://mycustom.okta.com/api/v1/sessions' },
      { name: 'custom okta format, port doesnt match', authenticator: 'HTTP://MYAPPS.MYDOMAIN.COM/SNOWFLAKE/OKTA', ssourl: 'https://MYAPPS.MYDOMAIN.COM/app/snowflake/mytokenmytoken/sso/saml',
        tokenurl: 'http://MYAPPS.MYDOMAIN.COM/api/v1/authn' },
      { name: '.okta.com format, ssourl and tokenurl match, port doesnt match', authenticator: 'https://mycustom.okta.com', ssourl: 'https://another.okta.com:8443/app/snowflake/mytokenmytokenmytoken',
        tokenurl: 'https://mycustom.okta.com:8443/api/v1/sessions' },
      { name: 'custom okta format, ssourl and tokenurl match, port doesnt match', authenticator: 'HTTPS://MYAPPS.MYDOMAIN.COM/SNOWFLAKE/OKTA', ssourl: 'https://MYAPPS.MYDOMAIN.COM:8443/app/snowflake/mytokenmytoken/sso/saml',
        tokenurl: 'https://MYAPPS.MYDOMAIN.COM:8443/api/v1/authn' },
      { name: '.okta.com format, authenticator port substring of ssourl port', authenticator: 'https://mycustom.okta.com:3030', ssourl: 'https://another.okta.com:30303/app/snowflake/mytokenmytokenmytoken',
        tokenurl: 'https://mycustom.okta.com/api/v1/sessions' },
      { name: 'custom okta format, ssourl/tokenurl port substring of authenticator port', authenticator: 'HTTPS://MYAPPS.MYDOMAIN.COM:8443/SNOWFLAKE/OKTA', ssourl: 'https://MYAPPS.MYDOMAIN.COM:443/app/snowflake/mytokenmytoken/sso/saml',
        tokenurl: 'https://MYAPPS.MYDOMAIN.COM:443/api/v1/authn' }
    ].forEach(({ name, authenticator, ssourl, tokenurl }) => {
      it(`${name}`, () => {
        assert.equal(mockValidateURLs(authenticator, ssourl, tokenurl), true);
      });
    });
  });
});
