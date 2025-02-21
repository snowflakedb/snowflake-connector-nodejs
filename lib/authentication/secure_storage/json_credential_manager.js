const path = require('path');
const Logger = require('../../logger');
const fs = require('node:fs/promises');
const Util = require('../../util');
const os = require('os');
const { validateOnlyUserReadWritePermissionAndOwner } = require('../../file_util');

function JsonCredentialManager(credentialCacheDir, timeoutMs = 60000) {
  const topLevelKey = 'tokens';

  this.getTokenDirCandidates = function () {
    const candidates = [];
    if (Util.exists(credentialCacheDir)) {
      candidates.push({ folder: credentialCacheDir, subfolders: [] });
    }
    const sfTemp = process.env.SF_TEMPORARY_CREDENTIAL_CACHE_DIR;
    if (Util.exists(sfTemp)) {
      candidates.push({ folder: sfTemp, subfolders: [] });
    }
    const xdgCache = process.env.XDG_CACHE_HOME;
    if (Util.exists(xdgCache) && process.platform === 'linux') {
      candidates.push({ folder: xdgCache, subfolders: ['snowflake'] });
    }
    const home = process.env.HOME;
    switch (process.platform) {
    case 'win32':
      candidates.push({ folder: os.homedir(), subfolders: ['AppData', 'Local', 'Snowflake', 'Caches'] });
      break;
    case 'linux':
      if (Util.exists(home)) {
        candidates.push({ folder: home, subfolders: ['.cache', 'snowflake'] });
      }
      break;
    case 'darwin':
      if (Util.exists(home)) {
        candidates.push({ folder: home, subfolders: ['Library', 'Caches', 'Snowflake'] });
      }
    }
    return candidates;
  };

  this.tryTokenDir = async function (dir, subDirs) {
    const cacheDir = path.join(dir, ...subDirs);
    try {
      const stat = await fs.stat(dir);
      if (!stat.isDirectory()) {
        Logger.getInstance().info(`Path ${dir} is not a directory`);
        return false;
      }
      let exists = true;
      const cacheStat = await fs.stat(cacheDir).catch(() => {
        exists = false;
        return null;
      });
      if (!exists) {
        const options = { recursive: true };
        if (process.platform !== 'win32') {
          options.mode = 0o700;
        }
        await fs.mkdir(cacheDir, options);
        return true;
      } else {
        if (process.platform === 'win32') {
          return true;
        }
        if ((cacheStat.mode & 0o777) === 0o700) {
          return true;
        }
        await fs.chmod(cacheDir, 0o700);
        return true;
      }
    } catch (err) {
      Logger.getInstance().warn(`The path location ${cacheDir} is invalid. Please check this location is accessible or existing`);
      return false;
    }
  };

  this.getTokenDir = async function () {
    const candidates = this.getTokenDirCandidates();
    for (const candidate of candidates) {
      const { folder: dir, subfolders: subDirs } = candidate;
      if (await this.tryTokenDir(dir, subDirs)) {
        return path.join(dir, ...subDirs);
      } else {
        Logger.getInstance().info(`${path.join(dir, ...subDirs)} is not a valid cache directory`);
      }
    }
    return null;
  };

  this.getTokenFile = async function () {
    const tokenDir = await this.getTokenDir();

    if (!Util.exists(tokenDir)) {
      throw new Error(`Temporary credential cache directory is invalid, and the driver is unable to use the default location. 
      Please set 'credentialCacheDir' connection configuration option to enable the default credential manager.`);
    }

    const tokenCacheFile = path.join(tokenDir, 'credential_cache_v1.json');
    await validateOnlyUserReadWritePermissionAndOwner(tokenCacheFile);
    return tokenCacheFile;
  };
   
  this.readJsonCredentialFile = async function (file) {
    try {
      const cred = await fs.readFile(file, 'utf8');
      return JSON.parse(cred);
    } catch (err) {
      Logger.getInstance().warn('Failed to read token data from the file. Err: %s', err.message);
      return null;
    }
  };

  this.removeStale = async function (file) {
    const stat = await fs.stat(file).catch(() => {
      return undefined;
    });
    if (!Util.exists(stat)) {
      return;
    }
    if (new Date().getTime() - stat.birthtimeMs > timeoutMs) {
      try {
        await fs.rmdir(file);
      } catch (err) {
        Logger.getInstance().warn('Failed to remove stale file. Error: %s', err.message);
      }
    }

  };


  this.withFileLocked = async function (fun) {
    const file = await this.getTokenFile();
    const lckFile = file + '.lck';
    await this.removeStale(lckFile);
    let attempts = 1;
    let locked = false;
    const options = {};
    if (process.platform !== 'win32') {
      options.mode = 0o600;
    }
    while (attempts <= 10) {
      Logger.getInstance().debug('Attempting to get a lock on file %s, attempt: %d', file, attempts);
      attempts++;
      await fs.mkdir(lckFile, options).then(() => {
        locked = true;
      }, () => {});
      if (locked) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!locked) {
      throw new Error('Could not acquire lock on cache file');
    }
    const res = await fun(file);
    await fs.rmdir(lckFile);
    return res;
  };
  
  this.write = async function (key, token) {
    if (!validateTokenCacheOption(key)) {
      return null;
    }

    await this.withFileLocked(async (file) => {
      const jsonCredential = await this.readJsonCredentialFile(file) || {};
      if (!Util.exists(jsonCredential[topLevelKey])) {
        jsonCredential[topLevelKey] = {};
      }
      jsonCredential[topLevelKey][key] = token;

      try {
        await fs.writeFile(file, JSON.stringify(jsonCredential), { mode: 0o600 });
      } catch (err) {
        throw new Error(`Failed to write token data in ${file}. Please check the permission or the file format of the token. ${err.message}`);
      }
    });
  };
  
  this.read = async function (key) {
    if (!validateTokenCacheOption(key)) {
      return null;
    }

    return await this.withFileLocked(async (file) => {
      const jsonCredential = await this.readJsonCredentialFile(file);
      if (!!jsonCredential && jsonCredential[topLevelKey] && jsonCredential[topLevelKey][key]) {
        return jsonCredential[topLevelKey][key];
      } else {
        return null;
      }
    });
  };
  
  this.remove = async function (key) {
    if (!validateTokenCacheOption(key)) {
      return null;
    }
    await this.withFileLocked(async (file) => {
      const jsonCredential = await this.readJsonCredentialFile(file);

      if (jsonCredential && jsonCredential[topLevelKey] && jsonCredential[topLevelKey][key]) {
        try {
          jsonCredential[topLevelKey][key] = null;
          await fs.writeFile(file, JSON.stringify(jsonCredential), { mode: 0o600 });
        } catch (err) {
          throw new Error(`Failed to write token data from the file in ${file}. Please check the permission or the file format of the token. ${err.message}`);
        }
      }
    });
  };

  function validateTokenCacheOption(key) {
    return Util.checkParametersDefined(key); 
  }
}

module.exports = JsonCredentialManager;