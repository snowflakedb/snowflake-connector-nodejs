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
const credType2 = 'mock_cred2';
const key = Util.buildCredentialCacheKey(host, user, credType);
const key2 = Util.buildCredentialCacheKey(host, user, credType2);
const randomPassword = randomUUID();
const randomPassword2 = randomUUID();
const os = require('os');
const fs = require('node:fs/promises');

const pathFromHome = function () {
  switch (process.platform) {
  case 'win32':
    return ['AppFata', 'Local', 'Snowflake', 'Caches'];
  case 'linux':
    return ['.cache', 'snowflake'];
  case 'darwin':
    return ['Library', 'Caches', 'Snowflake'];
  }
  return [];
};

describe('Json credential manager basic test', function () {
  const credentialManager = new JsonCredentialManager();
  it('test - initiate credential manager', async function () {
    if (await credentialManager.read(key) !== null) {
      await credentialManager.remove(key);
    }
    const savedPassword = await credentialManager.read(key);
    assert.strictEqual(await credentialManager.getTokenFile(), path.join(os.homedir(), ...pathFromHome(), 'credential_cache_v1.json'));
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
});

describe('Json credential manager provided path test', function () {
  const cacheFromEnvPath = path.join(os.homedir(), 'snowflakeTests', 'cacheFromEnv');
  const cacheFromXDGPath = path.join(os.homedir(), 'snowflakeTests', 'cacheFromXDG');
  const cacheFromUserPath = path.join(os.homedir(), 'snowflakeTests', 'user');
  const credentialManager = new JsonCredentialManager(cacheFromUserPath);
  process.env['SF_TEMPORARY_CREDENTIAL_CACHE_DIR'] = cacheFromEnvPath;
  process.env['XDG_CACHE_HOME'] = cacheFromXDGPath;
  it('test - user cache', async function () {
    await fs.mkdir(cacheFromUserPath, { recursive: true, mode: 0o700 });
    assert.strictEqual(await credentialManager.getTokenFile(), path.join(cacheFromUserPath, 'credential_cache_v1.json'));
    await fs.rm(cacheFromUserPath, { recursive: true });
  });
  it('test - env variable cache', async function () {
    await fs.mkdir(cacheFromEnvPath, { recursive: true, mode: 0o700 });
    assert.strictEqual(await credentialManager.getTokenFile(), path.join(cacheFromEnvPath, 'credential_cache_v1.json'));
    await fs.rm(cacheFromEnvPath, { recursive: true });
  });
  it('test - user cache over env variable cache', async function () {
    await fs.mkdir(cacheFromUserPath, { recursive: true, mode: 0o700 });
    await fs.mkdir(cacheFromEnvPath, { recursive: true, mode: 0o700 });
    assert.strictEqual(await credentialManager.getTokenFile(), path.join(cacheFromUserPath, 'credential_cache_v1.json'));
    await fs.rm(cacheFromUserPath, { recursive: true });
    await fs.rm(cacheFromEnvPath, { recursive: true });
  });
  it('test - defaults to home', async function () {
    assert.strictEqual(await credentialManager.getTokenFile(), path.join(os.homedir(), ...pathFromHome(), 'credential_cache_v1.json'));
  });
  if (process.platform === 'linux') {
    it('test - xdg variable cache', async function () {
      await fs.mkdir(cacheFromXDGPath, { recursive: true, mode: 0o700 });
      assert.strictEqual(await credentialManager.getTokenFile(), path.join(cacheFromXDGPath, 'credential_cache_v1.json'));
      await fs.rm(cacheFromXDGPath, { recursive: true });
    });
    it('test - env variable cache over xdg cache', async function () {
      await fs.mkdir(cacheFromEnvPath, { recursive: true, mode: 0o700 });
      await fs.mkdir(cacheFromXDGPath, { recursive: true, mode: 0o700 });
      assert.strictEqual(await credentialManager.getTokenFile(), path.join(cacheFromEnvPath, 'credential_cache_v1.json'));
      await fs.rm(cacheFromEnvPath, { recursive: true });
      await fs.rm(cacheFromXDGPath, { recursive: true });
    });
  }
});

describe('Json credential manager locks', function () {
  const cacheDirPath = path.join(os.homedir(), ...pathFromHome());
  const lockPath = path.join(cacheDirPath, 'credential_cache_v1.json.lck');
  it('test - file locked failure', async function () {
    await fs.mkdir(lockPath, { recursive: true, mode: 0o700 });
    const credentialManager = new JsonCredentialManager();
    assert.rejects(async () => {
      await credentialManager.write(key, randomPassword);
    }, 'Could not acquire lock on cache file');
  });
  it('test - stale lock', async function () {
    await fs.mkdir(lockPath, { recursive: true, mode: 0o700 });
    const credentialManager = new JsonCredentialManager(null, 0);
    await credentialManager.write(key, randomPassword);
  });
});

describe('Json credential format', function () {
  const cacheDirPath = path.join(os.homedir(), ...pathFromHome());
  it('test - json format', async function () {
    const credentialManager = new JsonCredentialManager();
    await credentialManager.write(key, randomPassword);
    await credentialManager.write(key2, randomPassword2);
    const credentials = JSON.parse(await fs.readFile(path.join(cacheDirPath, 'credential_cache_v1.json'), 'utf8'));
    assert.strictEqual(Util.exists(credentials), true);
    assert.strictEqual(Util.exists(credentials['tokens']), true);
    assert.strictEqual(credentials['tokens'][key], randomPassword);
    assert.strictEqual(credentials['tokens'][key2], randomPassword2);
  });
});

