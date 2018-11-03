/*
 * Copyright (c) 2015-2018 Snowflake Computing Inc. All rights reserved.
 */

var Logger = require('./../../../lib/logger/browser');
var assert = require('assert');

describe('Logger - browser', function()
{
  // TODO: negative tests
  // TODO: configuration tests

  var ERROR = 'ERROR';
  var WARN = 'WARN';
  var INFO = 'INFO';
  var DEBUG = 'DEBUG';
  var TRACE = 'TRACE';

  var LOG_MSG_ERROR = '0 error';
  var LOG_MSG_WARN  = '1 warn';
  var LOG_MSG_INFO  = '2 info';
  var LOG_MSG_DEBUG = '3 debug';
  var LOG_MSG_TRACE = '4 trace';

  var FULL_LOG_MSG_ERROR = ERROR + ': ' + LOG_MSG_ERROR;
  var FULL_LOG_MSG_WARN = WARN + ': ' + LOG_MSG_WARN;
  var FULL_LOG_MSG_INFO = INFO + ': ' + LOG_MSG_INFO;
  var FULL_LOG_MSG_DEBUG = DEBUG + ': ' + LOG_MSG_DEBUG;
  var FULL_LOG_MSG_TRACE = TRACE + ': ' + LOG_MSG_TRACE;

  var logMessages = function(logger)
  {
    logger.error(LOG_MSG_ERROR);
    logger.warn(LOG_MSG_WARN);
    logger.info(LOG_MSG_INFO);
    logger.debug(LOG_MSG_DEBUG);
    logger.trace(LOG_MSG_TRACE);
  };

  var createLogger = function(level)
  {
    return new Logger(
    {
      includeTimestamp : false,
      level            : level
    });
  };

  it('test all levels', function()
  {
    var logger;
    var logBuffer;

    // default log level is 2 (Info)
    logger = createLogger();
    assert.strictEqual(logger.getLevel(), 2);

    // create a new logger with the log level set to error and log some messages
    logger = createLogger(0);
    logMessages(logger);
    logBuffer = logger.getLogBuffer();

    // we should only have an error message
    assert.strictEqual(logBuffer.length, 1);
    assert.strictEqual(logBuffer[0], FULL_LOG_MSG_ERROR);

    // create a new logger with the log level set to warn and log some messages
    logger = createLogger(1);
    logMessages(logger);
    logBuffer = logger.getLogBuffer();

    // we should have one error message and one warn message
    assert.strictEqual(logBuffer.length, 2);
    assert.strictEqual(logBuffer[0], FULL_LOG_MSG_ERROR);
    assert.strictEqual(logBuffer[1], FULL_LOG_MSG_WARN);

    // create a new logger with the log level set to info and log some messages
    logger = createLogger(2);
    logMessages(logger);
    logBuffer = logger.getLogBuffer();

    // we should have one error message, one warn message and one info message
    assert.strictEqual(logBuffer.length, 3);
    assert.strictEqual(logBuffer[0], FULL_LOG_MSG_ERROR);
    assert.strictEqual(logBuffer[1], FULL_LOG_MSG_WARN);
    assert.strictEqual(logBuffer[2], FULL_LOG_MSG_INFO);

    // create a new logger with the log level set to debug and log some messages
    logger = createLogger(3);
    logMessages(logger);
    logBuffer = logger.getLogBuffer();

    // we should have one error message, one warn message, one info message and
    // one debug message
    assert.strictEqual(logBuffer.length, 4);
    assert.strictEqual(logBuffer[0], FULL_LOG_MSG_ERROR);
    assert.strictEqual(logBuffer[1], FULL_LOG_MSG_WARN);
    assert.strictEqual(logBuffer[2], FULL_LOG_MSG_INFO);
    assert.strictEqual(logBuffer[3], FULL_LOG_MSG_DEBUG);

    // create a new logger with the log level set to trace and log some messages
    logger = createLogger(4);
    logMessages(logger);
    logBuffer = logger.getLogBuffer();

    // we should have one error message, one warn message, one info message,
    // one debug message and one trace message
    assert.strictEqual(logBuffer.length, 5);
    assert.strictEqual(logBuffer[0], FULL_LOG_MSG_ERROR);
    assert.strictEqual(logBuffer[1], FULL_LOG_MSG_WARN);
    assert.strictEqual(logBuffer[2], FULL_LOG_MSG_INFO);
    assert.strictEqual(logBuffer[3], FULL_LOG_MSG_DEBUG);
    assert.strictEqual(logBuffer[4], FULL_LOG_MSG_TRACE);
  });
});