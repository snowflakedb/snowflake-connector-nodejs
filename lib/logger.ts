import BrowserLogger from './logger/browser';

let instance: BrowserLogger;

/**
 * Sets the logger instance. For internal use only.
 */
export function setInstance(newInstance: BrowserLogger) {
  instance = newInstance;
}

/**
 * Returns the current logger instance.
 * @deprecated
 *
 * In TypeScript, use default import:
 * ```
 *  import Logger from './Logger';
 *  Logger().info(...)
 * ```
 *
 * In JavaScript, use:
 * ```
 *  const Logger = require('./Logger').default;
 *  Logger().info(...)
 * ```
 */
export function getInstance() {
  // use the browser implementation of logger as the default implementation;
  // we do this so that unit tests don't fail when the modules they're testing
  // log messages
  //
  // TODO:
  // BrowserLogger API doesn't match regular logger used by the driver, replace this with actual logger
  // used in node when removing browser-related code.
  if (!instance) {
    instance = new BrowserLogger();
  }

  return instance;
}

export default () => getInstance();
