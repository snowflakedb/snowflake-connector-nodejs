const NodeLogger = require('./../../../lib/logger/node');
const assert = require('assert');
const { logTagToLevel, LOG_LEVEL_TAGS } = require('../../../lib/logger/core');
const fsPromises = require('fs/promises');
const path = require('path');
const os = require('os');
let tempDir = null;

describe('Logger node tests', function () {

  before(async function () {
    tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'node_logger_tests_'));
  });

  after(async function () {
    await fsPromises.rm(tempDir, { recursive: true, force: true });
  });

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

  const OBJ_LOG_MSG_ERROR = {
    level: ERROR,
    message: LOG_MSG_ERROR
  };

  const OBJ_LOG_MSG_WARN = {
    level: WARN,
    message: LOG_MSG_WARN
  };

  const OBJ_LOG_MSG_INFO = {
    level: INFO,
    message: LOG_MSG_INFO
  };

  const OBJ_LOG_MSG_DEBUG = {
    level: DEBUG,
    message: LOG_MSG_DEBUG
  };

  const OBJ_LOG_MSG_TRACE = {
    level: TRACE,
    message: LOG_MSG_TRACE
  };

  const millisTimeoutToFlushLogFile = 30;

  it('should use info level as default', function () {
    // given
    const logger = createLogger(null, 'snowflake_default.log');

    // when
    const level = logger.getLevel();

    // then
    assert.strictEqual(level, logTagToLevel(LOG_LEVEL_TAGS.INFO));
  });

  it('should log messages when a logger level is error', async function () {
    // given
    const filePath = path.join(tempDir, 'error_logs.log');
    const logger = createLogger(logTagToLevel(LOG_LEVEL_TAGS.ERROR), filePath);

    // when
    logMessages(logger);

    // then
    await closeTransportsWithTimeout(logger);
    const logs = await readLogs(filePath);
    assert.strictEqual(logs.length, 1);
    assert.deepStrictEqual(logs[0], OBJ_LOG_MSG_ERROR);
  });

  it('should log messages when a logger level is warn', async function () {
    // given
    const filePath = path.join(tempDir, 'warn_logs.log');
    const logger = createLogger(logTagToLevel(LOG_LEVEL_TAGS.WARN), filePath);

    // when
    logMessages(logger);

    // then
    await closeTransportsWithTimeout(logger);
    const logs = await readLogs(filePath);
    assert.strictEqual(logs.length, 2);
    assert.deepStrictEqual(logs[0], OBJ_LOG_MSG_ERROR);
    assert.deepStrictEqual(logs[1], OBJ_LOG_MSG_WARN);
  });

  it('should log messages when a logger level is info', async function () {
    // given
    const filePath = path.join(tempDir, 'info_logs.log');
    const logger = createLogger(logTagToLevel(LOG_LEVEL_TAGS.INFO), filePath);

    // when
    logMessages(logger);

    // then
    await closeTransportsWithTimeout(logger);
    const logs = await readLogs(filePath);
    assert.strictEqual(logs.length, 3);
    assert.deepStrictEqual(logs[0], OBJ_LOG_MSG_ERROR);
    assert.deepStrictEqual(logs[1], OBJ_LOG_MSG_WARN);
    assert.deepStrictEqual(logs[2], OBJ_LOG_MSG_INFO);
  });

  it('should log messages when a logger level is debug', async function () {
    // given
    const filePath = path.join(tempDir, 'debug_logs.log');
    const logger = createLogger(logTagToLevel(LOG_LEVEL_TAGS.DEBUG), filePath);

    // when
    logMessages(logger);

    // then
    await closeTransportsWithTimeout(logger);
    const logs = await readLogs(filePath);
    assert.strictEqual(logs.length, 4);
    assert.deepStrictEqual(logs[0], OBJ_LOG_MSG_ERROR);
    assert.deepStrictEqual(logs[1], OBJ_LOG_MSG_WARN);
    assert.deepStrictEqual(logs[2], OBJ_LOG_MSG_INFO);
    assert.deepStrictEqual(logs[3], OBJ_LOG_MSG_DEBUG);
  });

  it('should log messages when a logger level is trace', async function () {
    // given
    const filePath = path.join(tempDir, 'trace_logs.log');
    const logger = createLogger(logTagToLevel(LOG_LEVEL_TAGS.TRACE), filePath);

    // when
    logMessages(logger);

    // then
    await closeTransportsWithTimeout(logger);
    const logs = await readLogs(filePath);
    assert.strictEqual(logs.length, 5);
    assert.deepStrictEqual(logs[0], OBJ_LOG_MSG_ERROR);
    assert.deepStrictEqual(logs[1], OBJ_LOG_MSG_WARN);
    assert.deepStrictEqual(logs[2], OBJ_LOG_MSG_INFO);
    assert.deepStrictEqual(logs[3], OBJ_LOG_MSG_DEBUG);
    assert.deepStrictEqual(logs[4], OBJ_LOG_MSG_TRACE);
  });

  it('should not log any messages when a logger level is off', async function () {
    // given
    const filePath = path.join(tempDir, 'off_logs.log');
    const logger = createLogger(logTagToLevel(LOG_LEVEL_TAGS.OFF), filePath);

    // when
    logMessages(logger);

    // then
    await closeTransportsWithTimeout(logger);
    await assert.rejects(
      async () => await readLogs(filePath),
      (err) => {
        assert.strictEqual(err.name, 'Error');
        assert.match(err.message, /ENOENT: no such file or directory./);
        return true;
      });
  });

  it('should change log level and log file path', async function () {
    // given
    const filePath = path.join(tempDir, 'first_logs.log');
    const filePathChanged = path.join(tempDir, 'second_logs.log');
    const logger = createLogger(logTagToLevel(LOG_LEVEL_TAGS.ERROR), filePath);

    // when
    logMessages(logger);
    logger.configure({
      level: logTagToLevel(LOG_LEVEL_TAGS.INFO),
      filePath: filePathChanged
    });
    logMessages(logger);

    // then
    await closeTransportsWithTimeout(logger);
    const errorLogs = await readLogs(filePath);
    assert.strictEqual(errorLogs.length, 1);
    assert.deepStrictEqual(errorLogs[0], OBJ_LOG_MSG_ERROR);
    const infoLogs = await readLogs(filePathChanged);
    assert.strictEqual(infoLogs.length, 3);
    assert.deepStrictEqual(infoLogs[0], OBJ_LOG_MSG_ERROR);
    assert.deepStrictEqual(infoLogs[1], OBJ_LOG_MSG_WARN);
    assert.deepStrictEqual(infoLogs[2], OBJ_LOG_MSG_INFO);
  });

  async function readLogs(filePath) {
    const logs = await fsPromises.readFile(filePath, { encoding: 'utf8' });
    return logs.split('\n')
      .filter(s => s)
      .map(s => JSON.parse(s));
  }

  function createLogger(level, filePath) {
    return new NodeLogger(
      {
        includeTimestamp: false,
        level: level,
        filePath: filePath
      });
  }

  function logMessages(logger) {
    logger.error(LOG_MSG_ERROR);
    logger.warn(LOG_MSG_WARN);
    logger.info(LOG_MSG_INFO);
    logger.debug(LOG_MSG_DEBUG);
    logger.trace(LOG_MSG_TRACE);
  }

  async function closeTransportsWithTimeout(logger) {
    logger.closeTransports();
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, millisTimeoutToFlushLogFile);
    });
  }
});