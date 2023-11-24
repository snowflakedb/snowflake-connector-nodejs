const assert = require('assert');
const CredentialManager = require('../../../lib/authentication/SecureStorage/credentialManager');
const { randomUUID } = require('crypto');

describe('Secure Storage Test', function () {
  const host = 'mock_test';
  const user = 'mock_user';
  const credType = 'MOCK_CREDTYPE';
  const randomPassword = randomUUID();
  // const userNameForStorage = SecureStorage.buildTemporaryCredentialName(host, user, credType);

  // it('test build user name', function (done){
  //   assert.strictEqual(userNameForStorage,
  //     '{MOCK_TEST}:{MOCK_USER}:{SF_NODE_JS_DRIVER}:{MOCK_CREDTYPE}}'
  //   ); 
  //   done();
  // });

  it('test - write the mock credential in Local Storage', async function () {
    await CredentialManager.writeCredential(host, user, credType, randomPassword);
    const result = await CredentialManager.readCredential(host, user, credType);
    assert.strictEqual(randomPassword.toString(), result);
  });

  it('test - read the mock credential in Local Stoage', async function () {
    const savedPassword = await CredentialManager.readCredential(host, user, credType);
    assert.strictEqual(savedPassword, randomPassword);
  });

  it('test - delete the mock credential in Local Storage', async function () {
    await CredentialManager.deleteCredential(host, user, credType);
    const result = await CredentialManager.readCredential(host, user, credType);
    assert.ok(result === null || result === undefined);
  });
});
