import assert from 'assert';

const AuthSessionToken = require('../../../lib/authentication/auth_session_token');
const AuthenticationTypes = require('../../../lib/authentication/authentication_types');
const Core = require('../../../lib/core');
const MockHttpClient = require('../mock/mock_http_client');
const ConnectionConfig = require('../../../lib/connection/connection_config');

const clientInfo = {
  version: require('../../../package.json').version,
  environment: process.versions,
};

const snowflake = Core({
  qaMode: true,
  httpClient: new MockHttpClient(clientInfo),
  loggerClass: require('../../../lib/logger/node'),
  client: clientInfo,
});

describe('session token authentication', function () {
  describe('AuthSessionToken authenticator', function () {
    it('authenticate is a no-op', async function () {
      const config = { sessionToken: 'fake-token' };
      const auth = new AuthSessionToken(config);
      await auth.authenticate();
    });

    it('updateBody is a no-op (login request is never sent)', function () {
      const config = { sessionToken: 'fake-token' };
      const auth = new AuthSessionToken(config);
      const body = { data: {} };
      auth.updateBody(body);
      assert.deepStrictEqual(body, { data: {} });
    });

    it('throws when sessionToken is not provided', function () {
      assert.throws(
        () => new AuthSessionToken({}),
        /SESSION_TOKEN authenticator requires a sessionToken/,
      );
    });

    it('throws when connectionConfig is null', function () {
      assert.throws(
        () => new AuthSessionToken(null),
        /SESSION_TOKEN authenticator requires a sessionToken/,
      );
    });
  });

  describe('ConnectionConfig with session token', function () {
    it('auto-detects SESSION_TOKEN authenticator when sessionToken is present', function () {
      const config = new ConnectionConfig(
        {
          accessUrl: 'http://fakeaccount.snowflakecomputing.com',
          account: 'fakeaccount',
          username: 'fakeuser',
          sessionToken: 'fake-session-token-value',
          masterToken: 'fake-master-token-value',
        },
        false, // validateCredentials
        true, // qaMode
      );

      assert.strictEqual(config.getAuthenticator(), AuthenticationTypes.SESSION_TOKEN);
      assert.strictEqual(config.sessionToken, 'fake-session-token-value');
      assert.strictEqual(config.masterToken, 'fake-master-token-value');
    });

    it('defaults to SNOWFLAKE authenticator when no sessionToken is present', function () {
      const config = new ConnectionConfig(
        {
          accessUrl: 'http://fakeaccount.snowflakecomputing.com',
          account: 'fakeaccount',
          username: 'fakeuser',
          password: 'fakepass',
        },
        false,
        true,
      );

      assert.strictEqual(config.getAuthenticator(), AuthenticationTypes.DEFAULT_AUTHENTICATOR);
    });

    it('does not require username when sessionToken is present and validation is enabled', function () {
      // Should not throw even though username is missing
      const config = new ConnectionConfig(
        {
          accessUrl: 'http://fakeaccount.snowflakecomputing.com',
          account: 'fakeaccount',
          authenticator: 'SESSION_TOKEN',
          sessionToken: 'fake-session-token-value',
          masterToken: 'fake-master-token-value',
        },
        true, // validateCredentials = true
        true,
      );

      assert.strictEqual(config.getAuthenticator(), AuthenticationTypes.SESSION_TOKEN);
    });

    it('auto-detection skips username and password checks when validateCredentials is true', function () {
      // No authenticator field, no username, no password: should still work
      // because sessionToken triggers auto-detection which bypasses credential checks
      const config = new ConnectionConfig(
        {
          accessUrl: 'http://fakeaccount.snowflakecomputing.com',
          account: 'fakeaccount',
          sessionToken: 'fake-session-token-value',
          masterToken: 'fake-master-token-value',
        },
        true, // validateCredentials = true
        true,
      );

      assert.strictEqual(config.getAuthenticator(), AuthenticationTypes.SESSION_TOKEN);
      assert.strictEqual(config.sessionToken, 'fake-session-token-value');
    });
  });

  describe('Connection with session token', function () {
    it('creates a connection with sessionToken without password', function () {
      const connection = snowflake.createConnection({
        accessUrl: 'http://fakeaccount.snowflakecomputing.com',
        account: 'fakeaccount',
        username: 'fakeuser',
        sessionToken: 'fake-session-token-value',
        masterToken: 'fake-master-token-value',
      });

      assert.ok(connection);
    });

    it('connect succeeds without making a login request', function (done) {
      const connection = snowflake.createConnection({
        accessUrl: 'http://fakeaccount.snowflakecomputing.com',
        account: 'fakeaccount',
        username: 'fakeuser',
        sessionToken: 'fake-session-token-value',
        masterToken: 'fake-master-token-value',
      });

      // The MockHttpClient would throw an assertion error if any unregistered
      // HTTP request (such as a login request) were made. The fact that connect
      // succeeds without error proves no login request was issued.
      connection.connect(function (err: Error | null, conn: unknown) {
        assert.ok(!err, `connect should succeed but got: ${err?.message}`);
        assert.ok(conn);
        // Verify the connection is usable (in Connected state)
        assert.ok(connection.isUp(), 'connection should report as up');
        done();
      });
    });

    it('connect succeeds without username when sessionToken is present', function (done) {
      const connection = snowflake.createConnection({
        accessUrl: 'http://fakeaccount.snowflakecomputing.com',
        account: 'fakeaccount',
        sessionToken: 'fake-session-token-value',
        masterToken: 'fake-master-token-value',
      });

      connection.connect(function (err: Error | null, conn: unknown) {
        assert.ok(!err, `connect should succeed but got: ${err?.message}`);
        assert.ok(conn);
        done();
      });
    });
  });

  describe('Pool with session token', function () {
    it('creates a pool with sessionToken options', function () {
      const pool = snowflake.createPool(
        {
          accessUrl: 'http://fakeaccount.snowflakecomputing.com',
          account: 'fakeaccount',
          username: 'fakeuser',
          sessionToken: 'fake-session-token-value',
          masterToken: 'fake-master-token-value',
        },
        { min: 0, max: 2 },
      );

      assert.ok(pool);
    });
  });
});
