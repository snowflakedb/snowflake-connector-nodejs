/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const snowflake = require('./../../lib/snowflake');
const connOptions = require('./connectionOptions');
const assert = require('assert');
const fs = require('fs');
const fsPromises = require('fs').promises;
const crypto = require('crypto');
const Logger = require('../../lib/logger');
const path = require('path');
const os = require('os');
const Util = require('../../lib/util');

module.exports.createConnection = function (validConnectionOptionsOverride = {}) {
  return snowflake.createConnection({
    ...connOptions.valid,
    ...validConnectionOptionsOverride,
  });
};

module.exports.createProxyConnection = function () {
  return snowflake.createConnection(connOptions.connectionWithProxy);
};

module.exports.createConnectionPool = function () {
  return snowflake.createPool(connOptions.valid, { max: 10, min: 0, testOnBorrow: true });
};

module.exports.connect = function (connection, callback) {
  connection.connect(function (err) {
    assert.ok(!err, JSON.stringify(err));
    callback();
  });
};

module.exports.connectAsync = function (connection) {
  return new Promise((resolve, reject) => {
    connection.connect(err => err ? reject(err) : resolve());
  });
};

// Other connect-related methods form testUtil do not allow to pass the custom callback from tests
// This should be used when it is important to execute exactly the specified callback - with no wrapper
module.exports.connectAsyncWithOriginalCallback = function (connection, callback) {
  return connection.connectAsync(callback);
};

module.exports.destroyConnection = function (connection, callback) {
  connection.destroy(function (err) {
    assert.ok(!err, JSON.stringify(err));
    callback();
  });
};

module.exports.destroyConnectionAsync = function (connection) {
  return new Promise((resolve, reject) => {
    connection.destroy(err => err ? reject(err) : resolve());
  });
};

/**
 *
 * @param connection Active connection
 * @param sql sql to execute
 * @param callback callback function (err) => any
 * @param bindArray optional binds
 */
module.exports.executeCmd = function (connection, sql, callback, bindArray) {
  connection.execute({
    sqlText: sql,
    binds: bindArray !== undefined && bindArray != null ? bindArray : undefined,
    complete: err => callback(err)
  });
};

module.exports.executeCmdUsePool = function (connectionPool, sql, callback, bindArray) {
  connectionPool.use(async (clientConnection) => {
    await clientConnection.execute({
      sqlText: sql,
      binds: bindArray !== undefined && bindArray != null ? bindArray : undefined,
      complete: err => callback(err)
    });
  });
};

const executeCmdAsync = function (connection, sqlText, binds = undefined) {
  return new Promise((resolve, reject) => {
    connection.execute({
      sqlText,
      binds,
      complete: (err, _, rows) => err ? reject(err) : resolve(rows)
    });
  });
};

module.exports.executeCmdAsync = executeCmdAsync;

/**
 * Drop tables one by one if exist - any connection error is ignored
 * @param connection Connection
 * @param tableNames string[]
 * @return {Promise<void>}
 */
module.exports.dropTablesIgnoringErrorsAsync = async (connection, tableNames) => {
  for (const tableIdx in tableNames) {
    const tableName = tableNames[tableIdx];
    try {
      await executeCmdAsync(connection, `DROP TABLE IF EXISTS ${tableName}`);
    } catch (e) {
      Logger.getInstance().warn(`Cannot drop table ${tableName}: ${JSON.stringify(e)}`);
    }
  }
};

/**
 * Drop databases one by one if exist - any connection error is ignored
 * @param connection Connection
 * @param dbNames string[]
 * @return {Promise<void>}
 */
module.exports.dropDBsIgnoringErrorsAsync = async (connection, dbNames) => {
  for (const dbName of dbNames) {
    try {
      await executeCmdAsync(connection, `DROP DATABASE IF EXISTS ${dbName}`);
    } catch (e) {
      Logger.getInstance().warn(`Cannot drop database ${dbName}: ${JSON.stringify(e)}`);
    }
  }
};

module.exports.checkError = function (err) {
  assert.ok(!err, JSON.stringify(err));
};

module.exports.executeQueryAndVerify = function (connection, sql, expected, callback, bindArray, normalize, strict) {
  // Sometimes we may not want to normalize the row first
  normalize = (typeof normalize !== 'undefined' && normalize != null) ? normalize : true;
  strict = (typeof strict !== 'undefined' && strict != null) ? strict : true;
  const executeOptions = {};
  executeOptions.sqlText = sql;
  executeOptions.complete = function (err, stmt) {
    assert.ok(!err, JSON.stringify(err));
    let rowCount = 0;
    const stream = stmt.streamRows();
    stream.on('readable', function () {
      let row;
      while ((row = stream.read()) !== null) {
        if (strict) {
          assert.deepStrictEqual(normalize ? normalizeRowObject(row) : row, expected[rowCount]);
        } else {
          assert.deepEqual(normalize ? normalizeRowObject(row) : row, expected[rowCount]);
        }
        rowCount++;
      }
    });
    stream.on('error', function (err) {
      assert.ok(!err, JSON.stringify(err));
    });
    stream.on('end', function () {
      assert.strictEqual(rowCount, expected.length);
      callback();
    });
  };
  if (bindArray !== null && bindArray !== undefined) {
    executeOptions.binds = bindArray;
  }

  connection.execute(executeOptions);
};

module.exports.executeQueryAndVerifyUsePool = function (connectionPool, sql, expected, callback, bindArray, normalize, strict) {
  // Sometimes we may not want to normalize the row first
  normalize = (typeof normalize !== 'undefined' && normalize != null) ? normalize : true;
  strict = (typeof strict !== 'undefined' && strict != null) ? strict : true;
  const executeOptions = {};
  executeOptions.sqlText = sql;
  executeOptions.complete = function (err, stmt) {
    assert.ok(!err, JSON.stringify(err));
    let rowCount = 0;
    const stream = stmt.streamRows();
    stream.on('readable', function () {
      let row;
      while ((row = stream.read()) !== null) {
        if (strict) {
          assert.deepStrictEqual(normalize ? normalizeRowObject(row) : row, expected[rowCount]);
        } else {
          assert.deepEqual(normalize ? normalizeRowObject(row) : row, expected[rowCount]);
        }
        rowCount++;
      }
    });
    stream.on('error', function (err) {
      assert.ok(!err, JSON.stringify(err));
    });
    stream.on('end', function () {
      assert.strictEqual(rowCount, expected.length);
      callback();
    });
  };
  if (bindArray !== null && bindArray !== undefined) {
    executeOptions.binds = bindArray;
  }

  connectionPool.use(async (clientConnection) => {
    await clientConnection.execute(executeOptions);
  });
};

function normalizeValue(value) {
  const convertToString = (value !== null) && (value !== undefined)
    && (typeof value.toJSON === 'function');
  const convertToJSNumber = (value !== null) && (value !== undefined)
    && (typeof value.toJSNumber === 'function');
  // If this is a bigInt type then convert to JS Number instead of string JSON representation
  if (convertToJSNumber) {
    return value.toJSNumber();
  } else if (convertToString) {
    return  value.toJSON();
  } else {
    return value;
  }
}

function normalizeRowObject(row) {
  const normalizedRow = {};
  for (const key in row) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const value = row[key];
      normalizedRow[key] = normalizeValue(value, normalizedRow, key);
    }
  }
  return normalizedRow;
}

/**
 * @param file 
 */
module.exports.deleteFileSyncIgnoringErrors = function (file) {
  if (fs.existsSync(file)) {
    try {
      fs.unlinkSync(file);
    } catch (e) {
      Logger.getInstance().warn(`Cannot remove file ${file}: ${JSON.stringify(e)}`);
    }
  }
};

/**
 * @param directory string file path
 */
module.exports.deleteFolderSyncIgnoringErrors = function (directory) {
  try {
    if (fs.rm) { // node >= 14 has rm method for recursive delete and rmdir with recursive flag is deprecated
      fs.rmSync(directory, { recursive: true });
    } else {
      fs.rmdirSync(directory, { recursive: true });
    }
  } catch (e) {
    Logger.getInstance().warn(`Cannot delete folder ${directory}: ${JSON.stringify(e)}`);
  }
};

/**
 * @param name string
 */
module.exports.randomizeName = function (name) {
  if (name === null || name.trim() === '') {
    throw new Error('Name must be non empty string');
  }
  const randomString = crypto.randomBytes(4).toString('hex');
  return name.concat(randomString);
};

/**
 * @param expectedLevel string
 * @param expectedMessage string
 * @param actualMessage string
 */
module.exports.assertLogMessage = function (expectedLevel, expectedMessage, actualMessage) {
  const regexPattern = `^{"level":"${expectedLevel}","message":"\\[.*\\]: ${expectedMessage}`;
  return assert.match(actualMessage, new RegExp(regexPattern));
};

/**
 * @param directory string
 * @return string
 */
module.exports.createTestingDirectoryInTemp = function (directory) {
  const tempDir = path.join(os.tmpdir(), directory);
  fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
};

/**
 * @param mainDir string
 * @param fileName string
 * @param data string
 * @return string
 */
module.exports.createTempFile = function (mainDir, fileName, data = '') {
  const fullpath = path.join(mainDir, fileName);
  fs.writeFileSync(fullpath, data);
  return fullpath;
};
/**
 *  Async version of method to create temp file
 * @param mainDir string Main directory for created file
 * @param fileName string Created file name
 * @param data string Input for created file
 * @return string
 */
module.exports.createTempFileAsync = async function (mainDir, fileName, data = '') {
  const fullpath = path.join(mainDir, fileName);
  await fsPromises.writeFile(fullpath, data);
  return fullpath;
};

/**
 * @param option object
 */
module.exports.createRandomFileName = function ( option = { prefix: '', postfix: '', extension: '' }) {
  const randomName = crypto.randomUUID();
  const fileName = `${option.prefix || ''}${randomName}${option.postfix || ''}${option.extension || ''}`;
  return fileName;
};

module.exports.sleepAsync = function (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
};

module.exports.normalizeRowObject = normalizeRowObject;
module.exports.normalizeValue = normalizeValue;