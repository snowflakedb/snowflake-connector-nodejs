/*
 * Copyright (c) 2015-2023 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const CredentialManager = require('../../../lib/authentication/SecureStorage/credentialManager');
const Util = require('../../../lib/util');

const { randomUUID } = require('crypto');
const host = 'mock_host';
const user = 'mock_user';
const credType = 'mock_cred';
const token = 'mock_token';
const key = Util.buildCredentialCacheKey(host, user, credType);
const randomPassword = randomUUID();

describe('Credential Manager Test', function () {
  describe('checkForNull function Test', function () {
    const testCases = [
      {
        name: 'all the parameters are null or undefined',
        parameters: [null, undefined, null, null],
        result: true
      },
      {
        name: 'one parameter is null',
        parameters: ['a', 2, true, null],
        result: true
      },
      {
        name: 'all the parameter are existing',
        parameters: [host, user, credType, token],
        result: false
      },
    ];

    for (const { name, parameters, result } of testCases) {
      it(name, function () {
        assert.strictEqual(CredentialManager.checkForNull(...parameters), result);
      });
    }
  });

  it('test - initial the credential manager', function () {
    CredentialManager.remove(key);
    const savedPassword = CredentialManager.read(key);
    assert.strictEqual(savedPassword, null);
  });

  it('test - write the mock credential with the credential manager', function () {
    CredentialManager.write(key, randomPassword);
    const result = CredentialManager.read(key);
    assert.strictEqual(randomPassword, result);
  });

  it('test - delete the mock credential with the credential manager', function () {
    CredentialManager.remove(key);
    const result = CredentialManager.read(key);
    assert.ok(result === null);
  });
});
