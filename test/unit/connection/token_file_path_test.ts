import assert from 'assert';
import sinon from 'sinon';
import fs from 'fs';
import os from 'os';

const ConnectionConfig = require('./../../../lib/connection/connection_config');
const {
  TOKEN_BASED_AUTHENTICATORS,
} = require('./../../../lib/configuration/connection_configuration');

describe('ConnectionConfig: tokenFilePath', function () {
  const account = 'snowdriverswarsaw.us-west-2.aws';
  const tokenValue = 'a-token-read-from-disk';
  const tokenFilePath = '/fake/path/to/token';

  // We intentionally do NOT use sinon's .withArgs(...).callThrough() to let other
  // paths hit the real fs. Winston loads its transports/stream pipeline lazily on
  // the first log call (readTokenFromFile logs), and those internal module-loader
  // disk reads do not delegate correctly through sinon's .callThrough(), surfacing
  // as "Cannot find module './console'". Instead each stub captures the original fs
  // function and falls back to it manually for any path other than tokenFilePath.
  function stubTokenFile(contents: string | Error): void {
    const originalRealpathSync = fs.realpathSync;
    const originalStatSync = fs.statSync;
    const originalReadFileSync = fs.readFileSync;

    sinon.stub(fs, 'realpathSync').callsFake((path: any, ...args: any[]) => {
      if (path === tokenFilePath) {
        return tokenFilePath;
      }
      return originalRealpathSync(path, ...args);
    });
    sinon.stub(fs, 'statSync').callsFake((path: any, ...args: any[]) => {
      if (path === tokenFilePath) {
        return { mode: 0o600, uid: os.userInfo().uid } as fs.Stats;
      }
      return originalStatSync(path, ...args);
    });
    sinon.stub(fs, 'readFileSync').callsFake((path: any, ...args: any[]) => {
      if (path === tokenFilePath) {
        if (contents instanceof Error) {
          throw contents;
        }
        return contents;
      }
      return originalReadFileSync(path, ...args);
    });
  }

  afterEach(function () {
    sinon.restore();
  });

  TOKEN_BASED_AUTHENTICATORS.forEach(function (authenticator: string) {
    it(`reads the token from tokenFilePath for ${authenticator}`, function () {
      stubTokenFile(tokenValue + '\n');
      const config = new ConnectionConfig({
        account,
        username: 'test_user',
        authenticator,
        tokenFilePath,
      });
      assert.strictEqual(config.getToken(), tokenValue);
    });
  });

  it('does not read the token file for a non-token-based authenticator', function () {
    const readFileSync = sinon.spy(fs, 'readFileSync');
    const config = new ConnectionConfig({
      account,
      username: 'test_user',
      password: 'test_pass',
      authenticator: 'SNOWFLAKE',
      tokenFilePath,
    });
    assert.strictEqual(config.getToken(), undefined);
    assert.ok(
      readFileSync.notCalled,
      'token file should not be read for a non-token authenticator',
    );
  });

  it('prefers an inline token over tokenFilePath', function () {
    const readFileSync = sinon.spy(fs, 'readFileSync');
    const config = new ConnectionConfig({
      account,
      username: 'test_user',
      authenticator: 'OAUTH',
      token: 'inline-token',
      tokenFilePath,
    });
    assert.strictEqual(config.getToken(), 'inline-token');
    assert.ok(readFileSync.notCalled, 'token file should not be read when an inline token is set');
  });

  it('throws when the token file is empty', function () {
    stubTokenFile('');
    assert.throws(
      () =>
        new ConnectionConfig({
          account,
          username: 'test_user',
          authenticator: 'OAUTH',
          tokenFilePath,
        }),
      /Missing token value in/,
    );
  });

  it('throws a descriptive error when the token file does not exist', function () {
    stubTokenFile(new Error('ENOENT: no such file or directory'));
    assert.throws(
      () =>
        new ConnectionConfig({
          account,
          username: 'test_user',
          authenticator: 'OAUTH',
          tokenFilePath,
        }),
      /Failed to read the token from file:/,
    );
  });
});
