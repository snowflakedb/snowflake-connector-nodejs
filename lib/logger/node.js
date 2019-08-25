/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

var winston = require('winston');
var Core = require('./core');

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

  this.setLogger = function (logger)
  {
    winstonLogger = logger;
  };

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
      winstonLogger = new winston.createLogger(
        {
          transports:
            [
              new (winston.transports.Console)(),
              new (winston.transports.File)({filename: 'snowflake.log'})
            ],
          level: common.getLevelTag(),
          levels: common.getLevelTagsMap()
        });
    }

    // get the appropriate logging method using the level tag and use this
    // method to log the message
    winstonLogger[levelTag](message);
  };

  // create an inner implementation to which all our methods will be forwarded
  common = Core.createLogger(options, logMessage);

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
