/*
 * Copyright (c) 2015-2023 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const JsonCredentialManager = require('../../../lib/authentication/secure_storage/jsonCredentialManager');
const Util = require('../../../lib/util');

const { randomUUID } = require('crypto');
const host = 'mock_host';
const user = 'mock_user';
const credType = 'mock_cred';
const key = Util.buildCredentialCacheKey(host, user, credType);
const randomPassword = randomUUID();

describe('Json Credential Manager Test', function () {
  it('test - initial the credential manager', function () {
    JsonCredentialManager.remove(key);
    const savedPassword = JsonCredentialManager.read(key);
    assert.strictEqual(savedPassword, null);
  });

  it('test - write the mock credential with the credential manager', function () {
    JsonCredentialManager.write(key, randomPassword);
    const result = JsonCredentialManager.read(key);
    assert.strictEqual(randomPassword, result);
  });

  it('test - delete the mock credential with the credential manager', function () {
    JsonCredentialManager.remove(key);
    const result = JsonCredentialManager.read(key);
    assert.ok(result === null);
  });
});
