const assert = require('assert');
const JsonCredentialManager = require('../../../lib/authentication/secure_storage/json_credential_manager');
const Util = require('../../../lib/util');
const { randomUUID } = require('crypto');
const path = require('path');
const host = 'mock_host';
const user = 'mock_user';
const credType = 'mock_cred';
const key = Util.buildCredentialCacheKey(host, user, credType);
const randomPassword = randomUUID();
const os = require('os');

describe('Json credential manager test', function () {
  const credentialManager = new JsonCredentialManager();
  it('test - initiate credential manager', async function () {
    if (await credentialManager.read(key) !== null) {
      await credentialManager.remove(key);
    }
    const savedPassword = await credentialManager.read(key);
    assert.strictEqual(await credentialManager.getTokenDir(), path.join(os.homedir(), 'temporary_credential.json'));
    assert.strictEqual(savedPassword, null);
  });
  it('test - write the mock credential with the credential manager', async function () {
    await credentialManager.write(key, randomPassword);
    const result = await credentialManager.read(key);
    assert.strictEqual(randomPassword, result);
  });
  it('test - delete the mock credential with the credential manager', async function () {
    await credentialManager.remove(key);
    const result = await credentialManager.read(key);
    assert.ok(result === null);
  });
  it('test - token saving location when the user sets credentialCacheDir value', async function () {
    const credManager = new JsonCredentialManager(os.tmpdir());
    assert.strictEqual(await credManager.getTokenDir(), path.join(os.tmpdir(), 'temporary_credential.json'));
  });
});
