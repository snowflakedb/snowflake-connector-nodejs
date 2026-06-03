const ConnectionConfig = require('./../../../lib/connection/connection_config');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { isWindows } = require('../../../lib/util');

// Verifies that an OAUTH token_file_path / tokenFilePath supplied through
// programmatic connection options (not just connections.toml) is resolved into
// the token. Previously the SDK only read the token file when it loaded the TOML
// itself, so options-based callers silently sent an empty token.
describe('ConnectionConfig: token_file_path on the options path', function () {
  const account = 'snowdriverswarsaw.us-west-2.aws';
  const tokenValue = 'a-token-read-from-disk';
  let tempDir;
  let tokenFilePath;

  beforeEach(function () {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'token_file_path_test_'));
    tokenFilePath = path.join(tempDir, 'token');
    fs.writeFileSync(tokenFilePath, tokenValue + '\n');
    if (!isWindows()) {
      fs.chmodSync(tokenFilePath, '600');
    }
  });

  afterEach(function () {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('reads the token from token_file_path for OAUTH', function () {
    const config = new ConnectionConfig({
      account,
      username: 'test_user',
      authenticator: 'OAUTH',
      token_file_path: tokenFilePath,
    });
    assert.strictEqual(config.getToken(), tokenValue);
  });

  it('reads the token from tokenFilePath (camelCase) for OAUTH', function () {
    const config = new ConnectionConfig({
      account,
      username: 'test_user',
      authenticator: 'OAUTH',
      tokenFilePath: tokenFilePath,
    });
    assert.strictEqual(config.getToken(), tokenValue);
  });

  it('prefers an inline token over token_file_path', function () {
    const config = new ConnectionConfig({
      account,
      username: 'test_user',
      authenticator: 'OAUTH',
      token: 'inline-token',
      token_file_path: tokenFilePath,
    });
    assert.strictEqual(config.getToken(), 'inline-token');
  });
});
