const assert = require('assert');
const keytar = require('keytar');
const SecureStorage = require('../../../lib/authentication/secureStorage');
const { randomUUID } = require('crypto');

describe('Secure Storage Test', function () {
  const host = 'mock_test';
  const user = 'mock_user';
  const credType = 'MOCK_CREDTYPE';
  const randomPassword = randomUUID();
  const userNameForStorage = SecureStorage.buildTemporaryCredentialName(host, user, credType,0);

  async function findCredentialFromStorage (userName, password){
    const credentialList = await keytar.findCredentials(host);
    const result =  credentialList.some((element) => {
      return element.account === userName && element.password === password;
    });
    return result;
  }

  it('test build user name', function (done){
    assert.strictEqual(userNameForStorage,
      '{MOCK_TEST}:{MOCK_USER}:{SF_NODE_JS_DRIVER}:{MOCK_CREDTYPE}}'
    ); 
    done();
  });

  it('test - write the mock credential in Local Storage', async function () {
    await SecureStorage.writeCredential(host, user, credType, randomPassword);
    const result = await SecureStorage.readCredential(host, user, credType);
    assert.strictEqual(randomPassword.toString(), result);
  });

  it('test - read the mock credential in Local Stoage', async function () {
    const savedPassword = await SecureStorage.readCredential(host, user, credType, 0);
    assert.strictEqual(savedPassword, randomPassword);
  });

  it('test - delete the mock credential in Local Storage', async function () {
    await SecureStorage.deleteCredential(host, user, credType);
    const result = await findCredentialFromStorage(userNameForStorage, randomPassword);
    assert.strictEqual(result, false);
  });
});

