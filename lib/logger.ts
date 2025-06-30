import BrowserLogger from './logger/browser';

let instance: BrowserLogger;

/**
 * Sets the logger instance. For internal use only.
 */
export function setInstance(newInstance: BrowserLogger) {
  instance = newInstance;
};

/**
 * Returns the current logger instance.
 * @deprecated Use default import:
 * ```
 *  import Logger from './Logger';
 *  Logger().info(...)
 * ```
 */
export function getInstance() {
  // use the browser implementation of logger as the default implementation;
  // we do this so that unit tests don't fail when the modules they're testing
  // log messages
  if (!instance) {
    instance = new BrowserLogger();
  }

  return instance;
};

export default () => getInstance();
