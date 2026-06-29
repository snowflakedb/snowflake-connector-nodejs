const winston = require('winston');
const moment = require('moment');
const Core = require('./core');
const Util = require('../util');
const Errors = require('../errors');

const DEFAULT_ADDITIONAL_LOG_TO_CONSOLE = true;

/**
 * Creates a new Logger instance for when we're running in node.
 *
 * @param {Object} [options]
 *
 * @constructor
 */
function Logger(options) {
  let winstonLogger;
  const defaultFilePath = 'snowflake.log';
  let filePath = getFilePath(options);
  let additionalLogToConsole = DEFAULT_ADDITIONAL_LOG_TO_CONSOLE;
  let transportLabels = [];
  let customLogger;

  this.setLogger = function (logger) {
    winstonLogger = logger;
  };

  // This operation is for purpose of tests only.
  this.closeTransports = async function () {
    if (winstonLogger) {
      await new Promise((resolve) => {
        winstonLogger.on('finish', resolve);
        winstonLogger.end();
      });
    }
  };

  function reconfigureWinstonLogger(filePathInput, additionalLogToConsoleInput) {
    const currentWinstonLogger = winstonLogger;
    filePath = filePathInput ?? filePath;
    if (Util.isBoolean(additionalLogToConsoleInput)) {
      additionalLogToConsole = additionalLogToConsoleInput;
    } else {
      additionalLogToConsole = DEFAULT_ADDITIONAL_LOG_TO_CONSOLE;
    }
    winstonLogger = null; // it will be created for the first log operation
    if (currentWinstonLogger) {
      currentWinstonLogger.close();
    }
  }

  function setTransportLabels(transportLabelsInput) {
    transportLabels = transportLabelsInput;
  }

  this.getTransportLabels = function () {
    return transportLabels;
  };

  /**
   * Logs a message at a given level.
   *
   * @param {String} levelTag the tag associated with the level at which to log
   *   the message.
   * @param {String} message the message to log.
   */
  const logMessage = function (levelTag, message) {
    // A custom logger fully overrides the built-in winston file/console logging and
    // receives the bare (secret-masked) message; it is expected to add its own
    // timestamp, so we do not prepend the driver's one here.
    //
    // Universal Driver refactor: customLogger should become a first-class citizen
    // here - i.e. the logger always dispatches to a logger implementing this
    // interface, and the built-in file/console behavior becomes just a `defaultLogger`
    // implementing the same SnowflakeLogger interface (rather than the special-cased
    // winston branch below).
    if (customLogger) {
      customLogger[levelTag.toLowerCase()](message);
      return;
    }

    // initialize the winston logger if needed
    if (!winstonLogger) {
      let transports;
      let transportLabels;

      if ('STDOUT' === filePath.toUpperCase()) {
        transports = [new winston.transports.Console()];
        transportLabels = ['Console'];
      } else if (additionalLogToConsole === true) {
        transports = [
          new winston.transports.Console(),
          new winston.transports.File({ filename: filePath }),
        ];
        transportLabels = ['Console', 'File'];
      } else {
        transports = [new winston.transports.File({ filename: filePath })];
        transportLabels = ['File'];
      }

      winstonLogger = new winston.createLogger({
        transports: transports,
        level: common.getLevelTag(),
        levels: common.getLevelTagsMap(),
      });
      setTransportLabels(transportLabels);
    }

    // the built-in file/console format includes the driver timestamp
    if (common.getIncludeTimestamp()) {
      message = Util.format('[%s]: %s', moment().format('h:mm:ss.SSS A'), message);
    }

    // get the appropriate logging method using the level tag and use this
    // method to log the message
    winstonLogger[levelTag](message);
  };

  // create an inner implementation to which all our methods will be forwarded
  const common = Core.createLogger(options, logMessage, reconfigureWinstonLogger);

  function getFilePath(options) {
    if (Util.exists(options)) {
      Errors.assertInternal(Util.isObject(options));
      return options.filePath ?? defaultFilePath;
    }
    return defaultFilePath;
  }

  this.getLevelTag = function () {
    return common.getLevelTag();
  };

  this.getLevelTagsMap = function () {
    return common.getLevelTagsMap();
  };

  /**
   * Configures this logger.
   *
   * @param {Object} options
   */
  this.configure = function (options) {
    if (Util.isBoolean(options.additionalLogToConsole)) {
      additionalLogToConsole = options.additionalLogToConsole;
    } else {
      additionalLogToConsole = DEFAULT_ADDITIONAL_LOG_TO_CONSOLE;
    }
    // Declarative like additionalLogToConsole above: each configure() call fully
    // describes the desired logging state. Omitting customLogger reverts to the
    // built-in file/console logging; it is not sticky across configure() calls.
    customLogger = options.customLogger ?? undefined;
    common.configure(options);
  };

  /**
   * Returns the current log level.
   *
   * @returns {Number}
   */
  this.getLevel = function () {
    return common.getLevelNumber();
  };

  /**
   * Logs a given message at the error level.
   *
   * @param {String} message
   * @param params
   */
  this.error = function (message, ...params) {
    common.error.apply(common, [message, ...params]);
  };

  /**
   * Logs a given message at the warning level.
   *
   * @param {String} message
   * @param params
   */
  this.warn = function (message, ...params) {
    common.warn.apply(common, [message, ...params]);
  };

  /**
   * Logs a given message at the info level.
   *
   * @param {String} message
   * @param params
   */
  this.info = function (message, ...params) {
    common.info.apply(common, [message, ...params]);
  };

  /**
   * Logs a given message at the debug level.
   *
   * @param {String} message
   * @param params
   */
  this.debug = function (message, ...params) {
    common.debug.apply(common, [message, ...params]);
  };

  /**
   * Logs a given message at the trace level.
   *
   * @param {String} message
   * @param params
   */
  this.trace = function (message, ...params) {
    common.trace.apply(common, [message, ...params]);
  };

  /**
   * Returns the log buffer.
   *
   * @returns {String[]}
   */
  this.getLogBuffer = function () {
    return common.getLogBuffer();
  };
}

module.exports = Logger;
