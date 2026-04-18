import NodeLogger from './logger/node';

let instance: NodeLogger;

/**
 * Sets the logger instance. For internal use only.
 */
export function setInstance(newInstance: NodeLogger) {
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
  if (!instance) {
    instance = new NodeLogger();
  }

  return instance;
}

export default () => getInstance();
