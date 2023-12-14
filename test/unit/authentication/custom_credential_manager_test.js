/*
 * Copyright (c) 2015-2023 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const Util = require('../../../lib/util');
const { randomUUID } = require('crypto');
const GlobalConfig = require('../../../lib/global_config');
const host = 'mock_host';
const user = 'mock_user';
const credType = 'mock_cred';
const key = Util.buildCredentialCacheKey(host, user, credType);
const randomPassword = randomUUID();
const snowflake = require('snowflake-sdk');

describe('test - synchronous customCredentialManager', function () {
  before(() => {
    snowflake.configure({ customCredentialManager: {
      read: function (key) {
        return 'mock_token';
      },
      write: function (key, credential) {
        return 'token_saved';
      },
      remove: function (key) {
        return null;
      }
    }
    });
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

// describe('test - asynchronous customCredentialManager', function () {
        
//   before(() => {
//     snowflake.configure({ customCredentialManager: {
//       read: async function (key) {
//         return 'mock_token';
//       },
//       write: async function (key, credential) {
//         return 'token_saved';
//       },
//       remove: async function (key, credential) {
//         return null;
//       }
//     } });
//   });
        
//   it('test - custom credential manager read function', async function () {
//     const token = await GlobalConfig.getCredentialManager().read(key);
//     assert.strictEqual(token, 'mock_token');
//   });

//   it('test - custom credential manager write function', function () {
//     GlobalConfig.getCredentialManager().write(key, randomPassword).then((result) => {
//       assert.strictEqual(result, 'token_saved');
//     });
//   });
        
//   it('test - custom credential manager remove function', async function () {
//     const result = await GlobalConfig.getCredentialManager().remove(key);
//     assert.strictEqual(result, null);
//   });
// });