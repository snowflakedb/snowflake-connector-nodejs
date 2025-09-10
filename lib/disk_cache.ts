import path from 'path';
import fs from 'fs/promises';
import os from 'os';

// NOTE:
// Besides this file, there are other entrypoints implementing reading/writing cache files:
// - global_config.js
// - authentication/secure_storage/json_credential_manager.js
//
// We should refactor the code so every place is using utils from this file
export const DEFAULT_CACHE_DIR = {
  win32: ['AppData', 'Local', 'Snowflake', 'Caches'],
  linux: ['.cache', 'snowflake'],
  darwin: ['Library', 'Caches', 'Snowflake'],
};

export function getDefaultCacheDir() {
  switch (process.platform) {
    case 'win32':
      return path.join(os.homedir(), ...DEFAULT_CACHE_DIR.win32);
    case 'linux':
      return path.join(os.homedir(), ...DEFAULT_CACHE_DIR.linux);
    case 'darwin':
      return path.join(os.homedir(), ...DEFAULT_CACHE_DIR.darwin);
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

export async function createCacheDirIfNotExists(cacheDir: string) {
  const options: Parameters<typeof fs.mkdir>[1] = { recursive: true };
  if (process.platform !== 'win32') {
    options.mode = 0o755;
  }
  await fs.mkdir(cacheDir, options);
  if (process.platform !== 'win32') {
    await fs.chmod(cacheDir, 0o700);
  }
}

export async function writeCacheFile(filePath: string, content: Buffer) {
  const dirName = path.dirname(filePath);
  await createCacheDirIfNotExists(dirName);
  await fs.writeFile(filePath, content);
  if (process.platform !== 'win32') {
    await fs.chmod(filePath, 0o600);
  }
}
