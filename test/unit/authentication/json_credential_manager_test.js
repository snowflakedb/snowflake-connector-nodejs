/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

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

  it('test - initiate credential manager', function () {
    credentialManager.remove(key);
    const savedPassword = credentialManager.read(key);
    
    assert.strictEqual(credentialManager.tokenDir, path.join(os.homedir(), 'temporary_credential.json'));
    assert.strictEqual(savedPassword, null);
  });

  it('test - write the mock credential with the credential manager', function () {
    credentialManager.write(key, randomPassword);
    const result = credentialManager.read(key);
    assert.strictEqual(randomPassword, result);
  });

  it('test - delete the mock credential with the credential manager', function () {
    credentialManager.remove(key);
    const result = credentialManager.read(key);
    assert.ok(result === null);
  });

  it('test - token saving location when the user sets SF_TEMPORARY_CREDENTIAL_CACHE_DIR value', function () {
    process.env.SF_TEMPORARY_CREDENTIAL_CACHE_DIR = os.tmpdir();
    const credManager = new JsonCredentialManager();
    assert.strictEqual(credManager.tokenDir, path.join(os.tmpdir(), 'temporary_credential.json'));
    delete process.env.SF_TEMPORARY_CREDENTIAL_CACHE_DIR;
  });

});

describe('Json credential manager - no valid saving location', function () {
  const credentialManager = new JsonCredentialManager();
  credentialManager.tokenDir = null;

  it('test - initial the credential manager', function () {
    assert.strictEqual(credentialManager.tokenDir, null);
  });

  it('test - read the mock credential with the credential manager', function () {
    assert.strictEqual(credentialManager.read(key), null);
  });

  it('test - write the mock credential with the credential manager', function () {
    assert.strictEqual(credentialManager.write(key, randomPassword), null);
  });

  it('test - delete the mock credential with the credential manager', function () {
    assert.strictEqual(credentialManager.remove(key), null);
  });
});
