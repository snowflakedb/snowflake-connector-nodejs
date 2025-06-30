const assert = require('assert');
const net = require('net');
const crypto = require('crypto');
const jsonwebtoken = require('jsonwebtoken');
const fs = require('fs');
const sinon = require('sinon');

const authenticator = require('./../../../lib/authentication/authentication');
const AuthDefault = require('./../../../lib/authentication/auth_default');
const AuthWeb = require('./../../../lib/authentication/auth_web');
const AuthKeypair = require('./../../../lib/authentication/auth_keypair');
const AuthOauth = require('./../../../lib/authentication/auth_oauth');
const AuthOkta = require('./../../../lib/authentication/auth_okta');
const AuthIDToken = require('./../../../lib/authentication/auth_idtoken');
const AuthenticationTypes = require('./../../../lib/authentication/authentication_types');
const MockTestUtil = require('./../mock/mock_test_util');

// get connection options to connect to this mock snowflake instance
const mockConnectionOptions = MockTestUtil.connectionOptions;
const connectionOptions = mockConnectionOptions.default;
const connectionOptionsDefault = mockConnectionOptions.authDefault;
const connectionOptionsExternalBrowser = mockConnectionOptions.authExternalBrowser;
const connectionOptionsKeyPair = mockConnectionOptions.authKeyPair;
const connectionOptionsKeyPairPath = mockConnectionOptions.authKeyPairPath;
const connectionOptionsOauth = mockConnectionOptions.authOauth;
const connectionOptionsOkta = mockConnectionOptions.authOkta;
const connectionOptionsIdToken = mockConnectionOptions.authIdToken;

describe('default authentication', function () {

  it('default - authenticate method is thenable', done => {
    const auth = new AuthDefault(connectionOptions);

    auth.authenticate()
      .then(done)
      .catch(done);
  });

  it('default - check password', function () {
    const auth = new AuthDefault(connectionOptions);

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
      body['data']['AUTHENTICATOR'], AuthenticationTypes.DEFAULT_AUTHENTICATOR, 'Authenticator should be SNOWFLAKE');
  });

  it('test - passcode is only configured', function () {
    const auth = new AuthDefault({ ...connectionOptions, getPasscode: () => 'mockPasscode' });
    const body = authenticator.formAuthJSON(connectionOptions.authenticator,
      connectionOptions.account,
      connectionOptions.username,
      {}, {}, {});

    auth.updateBody(body);

    assert.strictEqual(body['data']['AUTHENTICATOR'], 'USERNAME_PASSWORD_MFA');
    assert.strictEqual(body['data']['PASSWORD'], connectionOptions.password);
    assert.strictEqual(body['data']['TOKEN'], undefined);
    assert.strictEqual(body['data']['PASSCODE'], 'mockPasscode');
    assert.strictEqual(body['data']['EXT_AUTHN_DUO_METHOD'], 'passcode');
  });

  it('test - passcodeInPassword option is enabled', function () {
    const auth = new AuthDefault({ ...connectionOptions, getPasscodeInPassword: () => true });
    const body = authenticator.formAuthJSON(connectionOptions.authenticator,
      connectionOptions.account,
      connectionOptions.username,
      {}, {}, {});

    auth.updateBody(body);

    assert.strictEqual(body['data']['AUTHENTICATOR'], 'USERNAME_PASSWORD_MFA');
    assert.strictEqual(body['data']['PASSWORD'], connectionOptions.password);
    assert.strictEqual(body['data']['TOKEN'], undefined);
    assert.strictEqual(body['data']['PASSCODE'], undefined);
    assert.strictEqual(body['data']['EXT_AUTHN_DUO_METHOD'], 'passcode');
  });

  it('test - mfa token is saved on the secure storage', function () {
    connectionOptions.mfaToken =  'mock_token';
    const auth = new AuthDefault(connectionOptions);
    const body = authenticator.formAuthJSON(connectionOptions.authenticator,
      connectionOptions.account,
      connectionOptions.username,
      {}, {}, {});

    auth.updateBody(body);

    assert.strictEqual(body['data']['AUTHENTICATOR'], 'USERNAME_PASSWORD_MFA');
    assert.strictEqual(body['data']['EXT_AUTHN_DUO_METHOD'], 'push');
    assert.strictEqual(body['data']['PASSWORD'], connectionOptions.password);
    assert.strictEqual(body['data']['TOKEN'], connectionOptions.mfaToken);
  });
});

describe('external browser authentication', function () {
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
  const browserOpenCallback = () => {
    const client = net.createConnection({ port: browserRedirectPort }, () => {
      client.write(`GET /?token=${mockToken} HTTP/1.1\r\n`);
    });
  };
  const httpResponseStub = sinon.stub();

  before(function () {
    httpclient = {
      requestAsync: async function (options) {
        const response = {
          data: {
            data: httpResponseStub()
          }
        };
        browserRedirectPort = options.data['data']['BROWSER_MODE_REDIRECT_PORT'];
        return response;
      }
    };
  });

  beforeEach(() => {
    httpResponseStub.returns({
      ssoUrl: mockSsoURL,
      proofKey: mockProofKey
    });
  });

  afterEach(() => {
    httpResponseStub.reset();
  });

  it('external browser - authenticate method is thenable', done => {
    const auth = new AuthWeb(connectionConfig, httpclient, browserOpenCallback);

    auth.authenticate(credentials.authenticator, '', credentials.account, credentials.username)
      .then(done)
      .catch(done);
  });

  it('external browser - get success', async function () {
    const auth = new AuthWeb(connectionConfig, httpclient, browserOpenCallback);
    await auth.authenticate(credentials.authenticator, '', credentials.account, credentials.username);

    const body = { data: {} };
    auth.updateBody(body);

    assert.strictEqual(body['data']['TOKEN'], mockToken);
    assert.strictEqual(body['data']['PROOF_KEY'], mockProofKey);
  });

  it('external browser - get fail', async function () {
    httpResponseStub.returns({ ssoUrl: mockSsoURL });
    const fastFailConnectionConfig = {
      getBrowserActionTimeout: () => 10,
      getProxy: () => {},
      getAuthenticator: () => credentials.authenticator,
      getServiceName: () => '',
      getDisableConsoleLogin: () => true,
      host: 'fakehost'
    };

    const auth = new AuthWeb(fastFailConnectionConfig, httpclient, () => null);
    await assert.rejects(async () => {
      await auth.authenticate(credentials.authenticator, '', credentials.account, credentials.username);
    }, {
      message: /Error while getting SAML token:/
    });
  });

  it('external browser - check authenticator', function () {
    const body = authenticator.formAuthJSON(connectionOptionsExternalBrowser.authenticator,
      connectionOptionsExternalBrowser.account,
      connectionOptionsExternalBrowser.username,
      {}, {}, {});

    assert.strictEqual(
      body['data']['AUTHENTICATOR'], AuthenticationTypes.EXTERNAL_BROWSER_AUTHENTICATOR, 'Authenticator should be EXTERNALBROWSER');
  });

  it('external browser - id token, no webbrowser', async function () {
    const auth = new AuthIDToken(connectionOptionsIdToken, httpclient);
    await auth.authenticate(credentials.authenticator, '', credentials.account, credentials.username, credentials.host);

    const body = { data: {} };
    auth.updateBody(body);

    assert.strictEqual(body['data']['TOKEN'], connectionOptionsIdToken.idToken);
    assert.strictEqual(body['data']['AUTHENTICATOR'], AuthenticationTypes.ID_TOKEN_AUTHENTICATOR);
  });

  it('external browser - id token, webbrowser cb provided', async function () {
    const auth = new AuthIDToken(connectionOptionsIdToken, httpclient, browserOpenCallback);
    await auth.authenticate(credentials.authenticator, '', credentials.account, credentials.username, credentials.host);

    const body = { data: {} };
    auth.updateBody(body);

    assert.strictEqual(body['data']['TOKEN'], connectionOptionsIdToken.idToken);
    assert.strictEqual(body['data']['AUTHENTICATOR'], AuthenticationTypes.ID_TOKEN_AUTHENTICATOR);
  });
});

describe('key-pair authentication', function () {
  let sinonSandbox;

  const mockToken = 'mockToken';
  const mockPrivateKeyFile = 'mockPrivateKeyFile';
  const mockPublicKeyObj = 'mockPublicKeyObj';

  before(function () {
    sinonSandbox = sinon.createSandbox();
    sinonSandbox.stub(crypto, 'createPrivateKey').callsFake((options) => {
      assert.strictEqual(options.key, mockPrivateKeyFile);
      if (options.passphrase) {
        assert.strictEqual(options.passphrase, connectionOptionsKeyPairPath.getPrivateKeyPass());
      }
      return {
        export: () =>  connectionOptionsKeyPair.getPrivateKey()
      };
    });
    sinonSandbox.stub(crypto, 'createPublicKey').callsFake((options) => {
      assert.strictEqual(options.key, connectionOptionsKeyPair.getPrivateKey());
      return {
        export: () => mockPublicKeyObj
      };
    });
    sinonSandbox.stub(crypto, 'createHash').returns({
      update: (publicKeyObj) => {
        assert.strictEqual(publicKeyObj, mockPublicKeyObj);
        return { digest: () => {} };
      }
    });
    sinonSandbox.stub(jsonwebtoken, 'sign').returns(mockToken);
    sinonSandbox.stub(fs, 'readFileSync').returns(mockPrivateKeyFile);
  });

  after(() => {
    sinonSandbox.restore();
  });

  it('key-pair - authenticate method is thenable', done => {
    const auth = new AuthKeypair(connectionOptionsKeyPair);
    auth.authenticate(connectionOptionsKeyPair.authenticator, '', connectionOptionsKeyPair.account, connectionOptionsKeyPair.username)
      .then(done)
      .catch(done);
  });

  it('key-pair - get token with private key', function () {
    const auth = new AuthKeypair(connectionOptionsKeyPair);
    auth.authenticate(connectionOptionsKeyPair.authenticator, '', connectionOptionsKeyPair.account, connectionOptionsKeyPair.username);

    const body = { data: {} };
    auth.updateBody(body);

    assert.strictEqual(
      body['data']['TOKEN'], mockToken, 'Token should be equal');
  });

  it('key-pair - get token with private key by reauthentication', async function () {
    const auth = new AuthKeypair(connectionOptionsKeyPair);

    const body = { data: { 'TOKEN': 'wrongToken' } };
    await auth.reauthenticate(body);

    assert.strictEqual(
      body['data']['TOKEN'], mockToken, 'Token should be equal');
  });

  it('key-pair - get token with private key path with passphrase', function () {
    const auth = new AuthKeypair(connectionOptionsKeyPairPath);

    auth.authenticate(connectionOptionsKeyPairPath.authenticator, '',
      connectionOptionsKeyPairPath.account,
      connectionOptionsKeyPairPath.username);

    const body = { data: {} };
    auth.updateBody(body);

    assert.strictEqual(
      body['data']['TOKEN'], mockToken, 'Token should be equal');
  });

  it('key-pair - get token with private key path without passphrase', function () {
    const auth = new AuthKeypair(connectionOptionsKeyPairPath);

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
      body['data']['AUTHENTICATOR'], AuthenticationTypes.KEY_PAIR_AUTHENTICATOR, 'Authenticator should be SNOWFLAKE_JWT');
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
      body['data']['AUTHENTICATOR'], AuthenticationTypes.OAUTH_AUTHENTICATOR, 'Authenticator should be OAUTH');
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
    httpclient = {
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
    };
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

    auth.reauthenticate(body, {
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
    httpclient = {
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
    };
    const auth = new AuthOkta(connectionOptionsOkta, httpclient);

    try {
      await auth.authenticate(connectionOptionsOkta.authenticator, '', connectionOptionsOkta.account, connectionOptionsOkta.username);
    } catch (err) {
      assert.strictEqual(err.message, 'Authenticator, SSO, or token URL is invalid.');
    }
  });

  it('okta - SAML response fail postback', async function () {
    httpclient = {
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
    };
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
    const auth = new AuthOkta(connectionOptionsOkta, httpclient);

    // positive cases
    [
      { name: '.okta.com format, ssourl and tokenurl matches', authenticator: 'https://MYCUSTOM.okta.com', ssourl: 'https://mycustom.okta.com/app/snowflake/mytokenmytokenmytoken',
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
        assert.doesNotThrow(() => {
          return  auth.validateURLs(authenticator, ssourl, tokenurl);
        });
      });
    });
    // negative cases
    [
      { name: '.okta.com format, ssourl doesnt match', authenticator: 'https://MyCUSTOM.okta.com', ssourl: 'https://another.okta.com/app/snowflake/mytokenmytokenmytoken',
        tokenurl: 'https://mycustom.okta.com/api/v1/sessions',  },
      { name: 'custom okta format, ssourl doesnt match', authenticator: 'HTTPS://MYAPPS.MYDOMAIN.COM/SNOWFLAKE/OKTA', ssourl: 'https://MYAPPS.MYDOMAIN.NET/app/snowflake/mytokenmytoken/sso/saml',
        tokenurl: 'https://MYAPPS.MYDOMAIN.COM/api/v1/authn' },
      { name: '.okta.com format, protocol doesnt match', authenticator: 'https://mycustom.okta.com', ssourl: 'http://mycustom.okta.com/app/snowflake/mytokenmytokenmytoken',
        tokenurl: 'http://mycustom.okta.com/api/v1/sessions' },
      { name: 'custom okta format, port doesnt match', authenticator: 'HTTP://MYAPPS.MYDOMAIN.COM/SNOWFLAKE/OKTA', ssourl: 'https://MYAPPS.MYDOMAIN.COM/app/snowflake/mytokenmytoken/sso/saml',
        tokenurl: 'http://MYAPPS.MYDOMAIN.COM/api/v1/authn' },
      { name: '.okta.com format, ssourl and tokenurl match, port doesnt match', authenticator: 'https://mycustom.okta.com', ssourl: 'https://mycustom.okta.com:8443/app/snowflake/mytokenmytokenmytoken',
        tokenurl: 'https://mycustom.okta.com:8443/api/v1/sessions' },
      { name: 'custom okta format, ssourl and tokenurl match, port doesnt match', authenticator: 'HTTPS://MYAPPS.MYDOMAIN.COM/SNOWFLAKE/OKTA', ssourl: 'https://MYAPPS.MYDOMAIN.COM:8443/app/snowflake/mytokenmytoken/sso/saml',
        tokenurl: 'https://MYAPPS.MYDOMAIN.COM:8443/api/v1/authn' },
      { name: '.okta.com format, authenticator port substring of ssourl port', authenticator: 'https://mycustom.okta.com:3030', ssourl: 'https://mycustom.okta.com:30303/app/snowflake/mytokenmytokenmytoken',
        tokenurl: 'https://mycustom.okta.com/api/v1/sessions' },
      { name: 'custom okta format, ssourl/tokenurl port substring of authenticator port', authenticator: 'https://myaPPS.MYDOMAIN.COM:8443/SNOWFLAKE/OKTA', ssourl: 'https://MYAPPS.MYDOMAIN.COM:443/app/snowflake/mytokenmytoken/sso/saml',
        tokenurl: 'https://MYAPPS.MYDOMAIN.COM:443/api/v1/authn' }
    ].forEach(({ name, authenticator, ssourl, tokenurl }) => {
      it(`${name}`, () => {
        assert.throws(() => {
          return  auth.validateURLs(authenticator, ssourl, tokenurl);
        }, { message: 'The prefix of the SSO/token URL and the specified authenticator do not match.' });
      });
    });
  });
});

describe('test getAuthenticator()', () => {
  [
    { name: 'default', providedAuth: AuthenticationTypes.DEFAULT_AUTHENTICATOR, expectedAuth: 'AuthDefault' },
    { name: 'external browser', providedAuth: AuthenticationTypes.EXTERNAL_BROWSER_AUTHENTICATOR, expectedAuth: 'AuthWeb' },
    { name: 'id token', providedAuth: AuthenticationTypes.EXTERNAL_BROWSER_AUTHENTICATOR, expectedAuth: 'AuthIDToken', idToken: 'idToken' },
    { name: 'key pair', providedAuth: AuthenticationTypes.KEY_PAIR_AUTHENTICATOR, expectedAuth: 'AuthKeypair' },
    { name: 'oauth', providedAuth: AuthenticationTypes.OAUTH_AUTHENTICATOR, expectedAuth: 'AuthOauth' },
    { name: 'okta', providedAuth: 'https://mycustom.okta.com:8443', expectedAuth: 'AuthOkta' },
    { name: 'workload identity', providedAuth: AuthenticationTypes.WORKLOAD_IDENTITY, expectedAuth: 'AuthWorkloadIdentity' },
    { name: 'unknown', providedAuth: 'unknown', expectedAuth: 'AuthDefault' }
  ].forEach(({ name, providedAuth, expectedAuth, idToken }) => {
    before(() => {
      sinon.stub(process, 'env').value({
        SF_ENABLE_EXPERIMENTAL_AUTHENTICATION: 'true'
      });
    });
    after(() => {
      sinon.restore();
    });

    it(`${name}`, () => {
      const connectionConfig = {
        getBrowserActionTimeout: () => 100,
        getProxy: () => {},
        getAuthenticator: () => providedAuth,
        getServiceName: () => '',
        getDisableConsoleLogin: () => true,
        getPrivateKey: () => '',
        getPrivateKeyPath: () => '',
        getPrivateKeyPass: () => '',
        getToken: () => '',
        getClientType: () => '',
        getClientVersion: () => '',
        getClientStoreTemporaryCredential: () => true,
        getPasscode: () => '',
        getPasscodeInPassword: () => false,
        idToken: idToken || null,
        host: 'host',
        workloadIdentityProvider: 'AWS',
      };

      assert.strictEqual(authenticator.getAuthenticator(connectionConfig, { }).constructor.name, expectedAuth);
    });
  });
});
