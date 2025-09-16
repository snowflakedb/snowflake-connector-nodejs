import Logger from './logger';

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
   * Enable CRL caching in memory. Cached entries are removed after crlCacheValidityTime.
   *
   * @default true
   */
  crlInMemoryCache: boolean;

  /**
   * Enable CRL caching on disk. Cached entries are removed after crlCacheValidityTime.
   *
   * Disk read/write failures are ignored.
   *
   * @default true
   */
  crlOnDiskCache: boolean;

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
}

export const GLOBAL_CONFIG_DEFAULTS: GlobalConfigOptionsTyped = {
  crlInMemoryCache: true,
  crlOnDiskCache: true,
  crlDownloadTimeout: 10000,
  crlCacheValidityTime: 86400000,
};

const GlobalConfigTyped: GlobalConfigOptionsTyped = {
  ...GLOBAL_CONFIG_DEFAULTS,
};

export default GlobalConfigTyped;

export const setGlobalConfigTypedOptions = (options: Partial<GlobalConfigOptionsTyped>) => {
  const filteredOptions = Object.fromEntries(
    Object.entries(options).filter(
      ([key, value]) => key in GLOBAL_CONFIG_DEFAULTS && value !== undefined,
    ),
  );
  Logger().debug('Setting global config typed options: %j', filteredOptions);
  Object.assign(GlobalConfigTyped, filteredOptions);
};
