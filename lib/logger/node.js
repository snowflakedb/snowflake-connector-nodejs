/*
 * Copyright (c) 2015-2023 Snowflake Computing Inc. All rights reserved.
 */

var winston = require('winston');
var Core = require('./core');
const Util = require('../util');
const Errors = require('../errors');

/**
 * Creates a new Logger instance for when we're running in node.
 *
 * @param {Object} [options]
 *
 * @constructor
 */
function Logger(options)
{
  var common;
  var winstonLogger;
  const defaultFilePath = 'snowflake.log';
  let filePath = getFilePath(options);

  this.setLogger = function (logger)
  {
    winstonLogger = logger;
  };

  /**
   * This operation is for purpose of tests only. The idea is to force flushing logs to files.
   * Winston logger emits 'finish' event before flushes all the transports so waiting for this event on logger is not good enough.
   * For simplicity, we just close each transport without waiting here.
   */
  this.closeTransports = function () {
      if (transportsCreated()) {
        for (const transport of winstonLogger.transports) {
          closeTransport(transport);
        }
      }
  };

  function transportsCreated() {
    try {
      winstonLogger.transports;
      return true;
    } catch (err) {
      return false;
    }
  }

  function closeTransport (transport, timeoutMillis) {
    if (!transport.close) {
      return;
    }
    transport.close();
  }

  function reconfigureWinstonLogger(filePathInput) {
    const currentWinstonLogger = winstonLogger;
    filePath = filePathInput ?? filePath;
    winstonLogger = null; // it will be created for the first log operation
    if (currentWinstonLogger) {
      currentWinstonLogger.close();
    }
  }

  /**
   * Logs a message at a given level.
   *
   * @param {String} levelTag the tag associated with the level at which to log
   *   the message.
   * @param {String} message the message to log.
   * @param {Number} bufferMaxLength the maximum size to which the message
   *   buffer can grow.
   */
  var logMessage = function (levelTag, message, bufferMaxLength)
  {
    // initialize the winston logger if needed
    if (!winstonLogger)
    {
      const transports = 'STDOUT' == filePath.toUpperCase()
        ? [ new (winston.transports.Console)() ]
        : [
          new (winston.transports.Console)(),
          new (winston.transports.File)({filename: filePath})
        ];
      winstonLogger = new winston.createLogger(
        {
          transports: transports,
          level: common.getLevelTag(),
          levels: common.getLevelTagsMap()
        });
    }

    // get the appropriate logging method using the level tag and use this
    // method to log the message
    winstonLogger[levelTag](message);
  };

  // create an inner implementation to which all our methods will be forwarded
  common = Core.createLogger(options, logMessage, reconfigureWinstonLogger);

  function getFilePath (options) {
    if (Util.exists(options)) {
      Errors.assertInternal(Util.isObject(options));
      return options.filePath ?? defaultFilePath;
    }
    return defaultFilePath;
  }

  this.getLevelTag = function ()
  {
    return common.getLevelTag();
  };

  this.getLevelTagsMap = function ()
  {
    return common.getLevelTagsMap();
  };

  /**
   * Configures this logger.
   *
   * @param {Object} options
   */
  this.configure = function (options)
  {
    common.configure(options);
  };

  /**
   * Returns the current log level.
   *
   * @returns {Number}
   */
  this.getLevel = function ()
  {
    return common.getLevelNumber();
  };

  /**
   * Logs a given message at the error level.
   *
   * @param {String} message
   */
  this.error = function (message)
  {
    common.error.apply(common, arguments);
  };

  /**
   * Logs a given message at the warning level.
   *
   * @param {String} message
   */
  this.warn = function (message)
  {
    common.warn.apply(common, arguments);
  };

  /**
   * Logs a given message at the info level.
   *
   * @param {String} message
   */
  this.info = function (message)
  {
    common.info.apply(common, arguments);
  };

  /**
   * Logs a given message at the debug level.
   *
   * @param {String} message
   */
  this.debug = function (message)
  {
    common.debug.apply(common, arguments);
  };

  /**
   * Logs a given message at the trace level.
   *
   * @param {String} message
   */
  this.trace = function (message)
  {
    common.trace.apply(common, arguments);
  };

  /**
   * Returns the log buffer.
   *
   * @returns {String[]}
   */
  this.getLogBuffer = function ()
  {
    return common.getLogBuffer();
  };
}

module.exports = Logger;
