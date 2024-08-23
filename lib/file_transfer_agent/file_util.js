/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const crypto = require('crypto');
const fs =  require('fs');
const path = require('path');
const struct = require('python-struct');
const zlib = require('zlib');
const os = require('os');
const glob = require('glob');
const Logger = require('../logger');

const resultStatus = {
  ERROR: 'ERROR',
  UPLOADED: 'UPLOADED',
  DOWNLOADED: 'DOWNLOADED',
  COLLISION: 'COLLISION',
  SKIPPED: 'SKIPPED',
  RENEW_TOKEN: 'RENEW_TOKEN',
  RENEW_PRESIGNED_URL: 'RENEW_PRESIGNED_URL',
  NOT_FOUND_FILE: 'NOT_FOUND_FILE',
  NEED_RETRY: 'NEED_RETRY',
  NEED_RETRY_WITH_LOWER_CONCURRENCY: 'NEED_RETRY_WITH_LOWER_CONCURRENCY'
};

exports.resultStatus = resultStatus;

// File Header
function FileHeader(digest, contentLength, encryptionMetadata) {
  return {
    'digest': digest,
    'contentLength': contentLength,
    'encryptionMetadata': encryptionMetadata
  };
}

exports.FileHeader = FileHeader;

/**
 * Creates a file utility object.
 *
 * @returns {Object}
 * @constructor
 */
function FileUtil() {
  /**
  * Compress file with GZIP.
  *
  * @param {String} fileName
  * @param {String} tmpDir
  *
  * @returns {Object}
  */
  this.compressFileWithGZIP = async function (fileName, tmpDir) {
    // Set file name and path for compressed file
    const baseName = path.basename(fileName);
    const gzipFileName = path.join(tmpDir, baseName + '_c.gz');

    await new Promise(function (resolve) {
      // Create gzip object
      const gzip = zlib.createGzip();
      // Create stream object for reader and writer
      const reader = fs.createReadStream(fileName);
      const writer = fs.createWriteStream(gzipFileName);
      // Write and compress file
      const result = reader.pipe(gzip).pipe(writer);
      result.on('finish', function () {
        resolve();
      });
    });

    await this.normalizeGzipHeader(gzipFileName);

    const fileInfo = fs.statSync(gzipFileName);

    return {
      name: gzipFileName,
      size: fileInfo.size
    };
  };

  /**
  * Normalize the header by removing the timestamp.
  * Note: GZIP in python includes the file name when compressing but
  * nodejs does not so there is no need to remove it here.
  * 
  * @param {String} gzipFileName
  *
  * @returns {null}
  */
  this.normalizeGzipHeader = async function (gzipFileName) {
    const fd = fs.openSync(gzipFileName, 'rs+');

    // Reset the timestamp in gzip header
    // Write at position 4
    fs.writeSync(fd, struct.pack('<L', 0), 0, 1, 4);

    fs.closeSync(fd);
  };

  /**
  * Get file digest and size.
  *
  * @param {String} fileName
  *
  * @returns {Object}
  */
  this.getDigestAndSizeForFile = async function (fileName) {
    const chunkSize = 16 * 4 * 1024;

    const fileInfo = fs.statSync(fileName);
    const bufferSize = fileInfo.size;

    let buffer = [];
    await new Promise(function (resolve) {
      // Create reader stream and set maximum chunk size
      const infile = fs.createReadStream(fileName, { highWaterMark: chunkSize });
      infile.on('data', function (chunk) {
        buffer.push(chunk);
      });
      infile.on('close', function () {
        buffer = Buffer.concat(buffer);
        resolve();
      });
    });

    const hash = crypto.createHash('sha256')
      .update(buffer)
      .digest('base64');

    return {
      digest: hash,
      size: bufferSize
    };
  };
}
exports.FileUtil = FileUtil;

function getMatchingFilePaths(dir, fileName) {
  const pathWithWildcard = path.join(dir, fileName);
  const pathWithWildcardDependsOnPlatform = os.platform() === 'win32'
    ? pathWithWildcard.replace(/\\/g, '/')
    : pathWithWildcard;
  return glob.sync(pathWithWildcardDependsOnPlatform);
}

function validateOnlyUserReadWritePermission(filePath) {
  if (os.platform() === 'win32') {
    return;
  }
  fs.accessSync(filePath, fs.constants.F_OK);
  const mode = (fs.statSync(filePath)).mode;
  const permission = (mode & 0o00777 | 0o600);
  //This should be 600 permission, which means the file permission has not been changed by others.
  if (permission === 0o600) {
    Logger.getInstance().debug(`Validated that the user has only read and write permission for file: ${filePath}, Permission: ${permission}`);
  } else {
    throw new Error(`File permissions different than read/write for user. File: ${filePath}`);
  }
}

function generateChecksum(str, algorithm, encoding) {
  return crypto
    .createHash(algorithm || 'sha256')
    .update(str, 'utf8')
    .digest(encoding || 'hex')
    .substring(0, 32);
}

exports.getMatchingFilePaths = getMatchingFilePaths;
exports.validateOnlyUserReadWritePermission = validateOnlyUserReadWritePermission;
exports.generateChecksum = generateChecksum;
