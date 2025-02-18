const assert = require('assert');
const Util = require('../../../lib/util');
const { randomUUID } = require('crypto');
const GlobalConfig = require('../../../lib/global_config');
const JsonCredentialManager = require('../../../lib/authentication/secure_storage/json_credential_manager');
const host = 'mock_host';
const user = 'mock_user';
const credType = 'mock_cred';
const key = Util.buildCredentialCacheKey(host, user, credType);
const randomPassword = randomUUID();
const defaultCredentialManager = new JsonCredentialManager();
const mockCustomCrednetialManager = {
  read: function () {
    return 'mock_token';
  },
  write: function () {
    return 'token_saved';
  },
  remove: function () {
    return null;
  }
};

describe('test - getter and setter for customCrendentialManager', () => {

  after(() => {
    GlobalConfig.setCustomCredentialManager(defaultCredentialManager);
  });

  it('test setCustomCredentialManager', () => {
    GlobalConfig.setCustomCredentialManager(mockCustomCrednetialManager);
    assert.strictEqual(GlobalConfig.getCredentialManager(), mockCustomCrednetialManager);
  });
});

describe('test - synchronous customCredentialManager', function () {
  
  before(() => {
    GlobalConfig.setCustomCredentialManager(mockCustomCrednetialManager);
  });

  after(() => {
    GlobalConfig.setCustomCredentialManager(defaultCredentialManager);
  });

  it('test - custom credential manager read function', function () {
    const token = GlobalConfig.getCredentialManager().read(key);
    assert.strictEqual(token, 'mock_token');
  });

  it('test - custom credential manager write function', function () {
    const result = GlobalConfig.getCredentialManager().write(key, randomPassword);
    assert.strictEqual(result, 'token_saved');
  });
        
  it('test - custom credential manager remove function', function () {
    const result = GlobalConfig.getCredentialManager().remove(key);
    assert.strictEqual(result, null);
  });
});

describe('test - asynchronous customCredentialManager', function () {
        
  before(() => {
    GlobalConfig.setCustomCredentialManager({
      read: async function () {
        return 'mock_token';
      },
      write: async function () {
        return 'token_saved';
      },
      remove: async function () {
        return null;
      }
    });
  });

  after(() => {
    GlobalConfig.setCustomCredentialManager(defaultCredentialManager);
  });
        
  it('test - custom credential manager read function', async function () {
    const token = await GlobalConfig.getCredentialManager().read(key);
    assert.strictEqual(token, 'mock_token');
  });

  it('test - custom credential manager write function', function () {
    GlobalConfig.getCredentialManager().write(key, randomPassword).then((result) => {
      assert.strictEqual(result, 'token_saved');
    });
  });
        
  it('test - custom credential manager remove function', async function () {
    const result = await GlobalConfig.getCredentialManager().remove(key);
    assert.strictEqual(result, null);
  });
});