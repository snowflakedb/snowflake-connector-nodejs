const Logger = require('./../../../lib/logger/browser');
const { logTagToLevel, LOG_LEVEL_TAGS } = require('./../../../lib/logger/core');
const assert = require('assert');

describe('Logger - browser', function () {
  // TODO: negative tests
  // TODO: configuration tests

  const ERROR = 'ERROR';
  const WARN = 'WARN';
  const INFO = 'INFO';
  const DEBUG = 'DEBUG';
  const TRACE = 'TRACE';

  const LOG_MSG_ERROR = '0 error';
  const LOG_MSG_WARN = '1 warn';
  const LOG_MSG_INFO = '2 info';
  const LOG_MSG_DEBUG = '3 debug';
  const LOG_MSG_TRACE = '4 trace';

  const FULL_LOG_MSG_ERROR = ERROR + ': ' + LOG_MSG_ERROR;
  const FULL_LOG_MSG_WARN = WARN + ': ' + LOG_MSG_WARN;
  const FULL_LOG_MSG_INFO = INFO + ': ' + LOG_MSG_INFO;
  const FULL_LOG_MSG_DEBUG = DEBUG + ': ' + LOG_MSG_DEBUG;
  const FULL_LOG_MSG_TRACE = TRACE + ': ' + LOG_MSG_TRACE;

  function logMessages(logger) {
    logger.error(LOG_MSG_ERROR);
    logger.warn(LOG_MSG_WARN);
    logger.info(LOG_MSG_INFO);
    logger.debug(LOG_MSG_DEBUG);
    logger.trace(LOG_MSG_TRACE);
  }

  function createLogger(level) {
    return new Logger(
      {
        includeTimestamp: false,
        level: level
      });
  }

  it('should use info level as default', function () {
    // given
    const logger = createLogger();

    // when
    const level = logger.getLevel();

    // then
    assert.strictEqual(level, logTagToLevel(LOG_LEVEL_TAGS.INFO));
  });

  it('should log messages when a logger level is error', function () {
    // given
    const logger = createLogger(logTagToLevel(LOG_LEVEL_TAGS.ERROR));

    // when
    logMessages(logger);

    // then
    const logBuffer = logger.getLogBuffer();
    assert.strictEqual(logBuffer.length, 1);
    assert.strictEqual(logBuffer[0], FULL_LOG_MSG_ERROR);
  });

  it('should log messages when a logger level is warn', function () {
    // given
    const logger = createLogger(logTagToLevel(LOG_LEVEL_TAGS.WARN));

    // when
    logMessages(logger);

    // then
    const logBuffer = logger.getLogBuffer();
    assert.strictEqual(logBuffer.length, 2);
    assert.strictEqual(logBuffer[0], FULL_LOG_MSG_ERROR);
    assert.strictEqual(logBuffer[1], FULL_LOG_MSG_WARN);
  });

  it('should log messages when a logger level is info', function () {
    // given
    const logger = createLogger(logTagToLevel(LOG_LEVEL_TAGS.INFO));

    // when
    logMessages(logger);

    // then
    const logBuffer = logger.getLogBuffer();
    assert.strictEqual(logBuffer.length, 3);
    assert.strictEqual(logBuffer[0], FULL_LOG_MSG_ERROR);
    assert.strictEqual(logBuffer[1], FULL_LOG_MSG_WARN);
    assert.strictEqual(logBuffer[2], FULL_LOG_MSG_INFO);
  });

  it('should log messages when a logger level is debug', function () {
    // given
    const logger = createLogger(logTagToLevel(LOG_LEVEL_TAGS.DEBUG));

    // when
    logMessages(logger);

    // then
    const logBuffer = logger.getLogBuffer();
    assert.strictEqual(logBuffer.length, 4);
    assert.strictEqual(logBuffer[0], FULL_LOG_MSG_ERROR);
    assert.strictEqual(logBuffer[1], FULL_LOG_MSG_WARN);
    assert.strictEqual(logBuffer[2], FULL_LOG_MSG_INFO);
    assert.strictEqual(logBuffer[3], FULL_LOG_MSG_DEBUG);
  });

  it('should log messages when a logger level is trace', function () {
    // given
    const logger = createLogger(logTagToLevel(LOG_LEVEL_TAGS.TRACE));

    // when
    logMessages(logger);

    // then
    const logBuffer = logger.getLogBuffer();
    assert.strictEqual(logBuffer.length, 5);
    assert.strictEqual(logBuffer[0], FULL_LOG_MSG_ERROR);
    assert.strictEqual(logBuffer[1], FULL_LOG_MSG_WARN);
    assert.strictEqual(logBuffer[2], FULL_LOG_MSG_INFO);
    assert.strictEqual(logBuffer[3], FULL_LOG_MSG_DEBUG);
    assert.strictEqual(logBuffer[4], FULL_LOG_MSG_TRACE);
  });

  it('should not log anything when a logger level is off', function () {
    // given
    const logger = createLogger(logTagToLevel(LOG_LEVEL_TAGS.OFF));

    // when
    logMessages(logger);

    // then
    const logBuffer = logger.getLogBuffer();
    assert.strictEqual(logBuffer.length, 0);
  });

  it('should change logger log level', function () {
    // given
    const logger = createLogger(logTagToLevel(LOG_LEVEL_TAGS.ERROR));

    // when
    logMessages(logger);
    logger.configure({
      level: logTagToLevel(LOG_LEVEL_TAGS.INFO),
      filePath: 'it does not matter'
    });
    logMessages(logger);

    // then
    const logBuffer = logger.getLogBuffer();
    assert.strictEqual(logBuffer.length, 4);
    assert.strictEqual(logBuffer[0], FULL_LOG_MSG_ERROR);
    assert.strictEqual(logBuffer[1], FULL_LOG_MSG_ERROR);
    assert.strictEqual(logBuffer[2], FULL_LOG_MSG_WARN);
    assert.strictEqual(logBuffer[3], FULL_LOG_MSG_INFO);
  });
});
