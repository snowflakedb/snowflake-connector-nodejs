const assert = require('assert');
const JsonCredentialManager = require('../../../lib/authentication/secure_storage/json_credential_manager');
const Util = require('../../../lib/util');
const { randomUUID, createHash } = require('crypto');
const path = require('path');
const os = require('os');
const fs = require('node:fs/promises');
const host = 'mock_host';
const user = 'mock_user';
const credType = 'mock_cred';
const credType2 = 'mock_cred2';
const key = Util.buildCredentialCacheKey(host, user, credType);
const key2 = Util.buildCredentialCacheKey(host, user, credType2);
const randomPassword = randomUUID();
const randomPassword2 = randomUUID();

const pathFromHome = function () {
  switch (process.platform) {
  case 'win32':
    return ['AppData', 'Local', 'Snowflake', 'Caches'];
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
    assert.strictEqual((await credentialManager.getTokenFile())[1], path.join(os.homedir(), ...pathFromHome(), 'credential_cache_v1.json'));
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
  after(async () => {
    await fs.rm(path.join(os.homedir(), ...pathFromHome(), 'credential_cache_v1.json'));
  });
});

describe('Json credential manager provided path test', function () {
  const cacheFromEnvPath = path.join(os.homedir(), 'snowflakeTests', 'cacheFromEnv');
  const XDGPath = path.join(os.homedir(), 'snowflakeTests', 'cacheFromXDG');
  const cacheFromXDGPath = path.join(XDGPath, 'snowflake');
  const cacheFromUserPath = path.join(os.homedir(), 'snowflakeTests', 'user');
  const credentialManager = new JsonCredentialManager(cacheFromUserPath);
  const sftccd = process.env['SF_TEMPORARY_CREDENTIAL_CACHE_DIR'];
  const xdgch = process.env['XDG_CACHE_HOME'];
  process.env['SF_TEMPORARY_CREDENTIAL_CACHE_DIR'] = cacheFromEnvPath;
  process.env['XDG_CACHE_HOME'] = XDGPath;
  it('test - user cache', async function () {
    await fs.mkdir(cacheFromUserPath, { recursive: true, mode: 0o700 });
    assert.strictEqual((await credentialManager.getTokenFile())[1], path.join(cacheFromUserPath, 'credential_cache_v1.json'));
    await fs.rm(cacheFromUserPath, { recursive: true, force: true });
  });
  it('test - env variable cache', async function () {
    await fs.mkdir(cacheFromEnvPath, { recursive: true, mode: 0o700 });
    assert.strictEqual((await credentialManager.getTokenFile())[1], path.join(cacheFromEnvPath, 'credential_cache_v1.json'));
    await fs.rm(cacheFromEnvPath, { recursive: true, force: true });
  });
  it('test - user cache over env variable cache', async function () {
    await fs.mkdir(cacheFromUserPath, { recursive: true, mode: 0o700 });
    await fs.mkdir(cacheFromEnvPath, { recursive: true, mode: 0o700 });
    assert.strictEqual((await credentialManager.getTokenFile())[1], path.join(cacheFromUserPath, 'credential_cache_v1.json'));
    await fs.rm(cacheFromUserPath, { recursive: true, force: true });
    await fs.rm(cacheFromEnvPath, { recursive: true, force: true });
  });
  it('test - defaults to home', async function () {
    assert.strictEqual((await credentialManager.getTokenFile())[1], path.join(os.homedir(), ...pathFromHome(), 'credential_cache_v1.json'));
  });
  if (process.platform === 'linux') {
    it('test - xdg variable cache', async function () {
      await fs.mkdir(cacheFromXDGPath, { recursive: true, mode: 0o700 });
      assert.strictEqual((await credentialManager.getTokenFile())[1], path.join(cacheFromXDGPath, 'credential_cache_v1.json'));
      await fs.rm(cacheFromXDGPath, { recursive: true, force: true });
    });
    it('test - env variable cache over xdg cache', async function () {
      await fs.mkdir(cacheFromEnvPath, { recursive: true, mode: 0o700 });
      await fs.mkdir(cacheFromXDGPath, { recursive: true, mode: 0o700 });
      assert.strictEqual((await credentialManager.getTokenFile())[1], path.join(cacheFromEnvPath, 'credential_cache_v1.json'));
      await fs.rm(cacheFromEnvPath, { recursive: true, force: true });
      await fs.rm(cacheFromXDGPath, { recursive: true, force: true });
    });
  }
  after(() => {
    if (Util.exists(sftccd)) {
      process.env['SF_TEMPORARY_CREDENTIAL_CACHE_DIR'] = sftccd;
    } else {
      delete process.env['SF_TEMPORARY_CREDENTIAL_CACHE_DIR'];
    }
    if (Util.exists(xdgch)) {
      process.env['XDG_CACHE_HOME'] = xdgch;
    } else {
      delete process.env['XDG_CACHE_HOME'];
    }

  });
});

describe('Json credential locked file failure', function () {
  const cacheDirPath = path.join(os.homedir(), ...pathFromHome());
  const lockPath = path.join(cacheDirPath, 'credential_cache_v1.json.lck');
  it('test - fail on locked file', async function () {
    await fs.mkdir(lockPath, { recursive: true, mode: 0o700 });
    const credentialManager = new JsonCredentialManager();
    let locked = false;
    await credentialManager.withFileLocked(() => {
      locked = true;
    });
    assert.strictEqual(locked, false);
    await fs.rm(lockPath, { recursive: true, force: true });
  });
});

describe('Json credential remove stale lock', function () {
  const cacheDirPath = path.join(os.homedir(), ...pathFromHome());
  const cacheFilePath = path.join(cacheDirPath, 'credential_cache_v1.json');
  const lockPath = path.join(cacheDirPath, 'credential_cache_v1.json.lck');
  it('test - stale lock', async function () {
    await fs.mkdir(lockPath, { recursive: true, mode: 0o700 });
    //Set timeout to negative because birthtime is a few ms of on Windows for some reason
    const credentialManager = new JsonCredentialManager(null, -100);
    await credentialManager.write(key, randomPassword);
    await fs.rm(cacheFilePath);
  });
});

describe('Json credential format', function () {
  const cacheDirPath = path.join(os.homedir(), ...pathFromHome());
  const cacheFilePath = path.join(cacheDirPath, 'credential_cache_v1.json');
  it('test - json format', async function () {
    const credentialManager = new JsonCredentialManager();
    await credentialManager.write(key, randomPassword);
    await credentialManager.write(key2, randomPassword2);
    const hashedKey1 = createHash('sha256').update(key).digest('hex');
    const hashedKey2 = createHash('sha256').update(key2).digest('hex');
    const credentials = JSON.parse(await fs.readFile(cacheFilePath, 'utf8'));
    assert.strictEqual(Util.exists(credentials), true);
    assert.strictEqual(Util.exists(credentials['tokens']), true);
    assert.strictEqual(credentials['tokens'][hashedKey1], randomPassword);
    assert.strictEqual(credentials['tokens'][hashedKey2], randomPassword2);
    await fs.rm(cacheFilePath);
  });
});

