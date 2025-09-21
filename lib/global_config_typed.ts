import path from 'path';
import os from 'os';
import Logger from './logger';
import { getDefaultCacheDir } from './disk_cache';

/*
 * NOTE:
 * Work In Progress migration of global_config.js to TypeScript.
 *
 * Instead of gettter+setter for each config option, we should use a signle object
 * Instead of manual input validation, we should rely on TypeScript's type system
 * This will simplify erorr codes, typing, mocking and testing = less code to maintain
 *
 * TODO:
 * When all global_config.js options are migrated:
 * - rename to global_config.ts
 * - removed "typed" from variable & function names
 */
export interface GlobalConfigOptionsTyped {
  /**
   * HTTP request timeout for CRL download.
   *
   * @default 10000 (ms)
   */
  crlDownloadTimeout: number;

  /**
   * Time after which cached CRL entries are invalidated.
   *
   * @default 86400000 (24 hours in ms)
   */
  crlCacheValidityTime: number;

  /**
   * Directory path to store CRL cache when crlOnDiskCache is true.
   *
   * @default
   * Reads from process.env.SNOWFLAKE_CRL_ON_DISK_CACHE_DIR if available.
   * Otherwise, defaults to:
   * - Windows: %USERPROFILE%/AppData/Local/Snowflake/Caches/crls
   * - Linux: $HOME/.cache/snowflake/crls
   * - macOS: $HOME/Library/Caches/Snowflake/crls
   */
  crlResponseCacheDir: string;
}

type GlobalConfigOptionsTypedWithGetters = {
  [K in keyof GlobalConfigOptionsTyped]:
    | GlobalConfigOptionsTyped[K]
    | (() => GlobalConfigOptionsTyped[K]);
};

export const GLOBAL_CONFIG_DEFAULTS = {
  crlDownloadTimeout: 10000,
  crlCacheValidityTime: 86400000,
  crlResponseCacheDir: () => {
    return process.env.SNOWFLAKE_CRL_ON_DISK_CACHE_DIR || path.join(getDefaultCacheDir(), 'crls');
  },
};

export const globalConfigSetOptions: Partial<GlobalConfigOptionsTyped> = {};

export default {
  setValues: (options: Partial<GlobalConfigOptionsTyped>) => {
    const filteredOptions = Object.fromEntries(
      Object.entries(options).filter(
        ([key, value]) => key in GLOBAL_CONFIG_DEFAULTS && value !== undefined,
      ),
    );
    Logger().debug('Setting global config typed values: %j', filteredOptions);
    Object.assign(globalConfigSetOptions, filteredOptions);
  },
  getValue: <K extends keyof GlobalConfigOptionsTyped>(key: K) => {
    const value = globalConfigSetOptions[key] ?? GLOBAL_CONFIG_DEFAULTS[key];
    if (typeof value === 'function') {
      return value();
    } else {
      return value as GlobalConfigOptionsTyped[K];
    }
  },
};
