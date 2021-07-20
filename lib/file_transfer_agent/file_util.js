/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var struct = require('python-struct');
var zlib = require('zlib');

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
function FileHeader(digest, contentLength, encryptionMetadata)
{
  return {
    "digest": digest,
    "contentLength": contentLength,
    "encryptionMetadata": encryptionMetadata
  }
}

exports.FileHeader = FileHeader;

/**
 * Creates a file utility object.
 *
 * @returns {Object}
 * @constructor
 */
function file_util ()
{
  /**
  * Compress file with GZIP.
  *
  * @param {String} fileName
  * @param {String} tmpDir
  *
  * @returns {Object}
  */
  this.compressFileWithGZIP = async function (fileName, tmpDir)
  {
    // Set file name and path for compressed file
    var baseName = path.basename(fileName);
    var gzipFileName = path.join(tmpDir, baseName + '_c.gz');

    await new Promise(function (resolve, reject)
    {
      // Create gzip object
      var gzip = zlib.createGzip();
      // Create stream object for reader and writer
      var reader = fs.createReadStream(fileName);
      var writer = fs.createWriteStream(gzipFileName);
      // Write and compress file
      var result = reader.pipe(gzip).pipe(writer);
      result.on('finish', function ()
      {
        resolve();
      });
    });

    await this.normalizeGzipHeader(gzipFileName);

    var fileInfo = fs.statSync(gzipFileName);

    return {
      name: gzipFileName,
      size: fileInfo.size
    }
  }

  /**
  * Normalize the header by removing the timestamp.
  * Note: GZIP in python includes the file name when compressing but
  * nodejs does not so there is no need to remove it here.
  * 
  * @param {String} gzipFileName
  *
  * @returns {null}
  */
  this.normalizeGzipHeader = async function (gzipFileName)
  {
    var fd = fs.openSync(gzipFileName, 'rs+');

    // Reset the timestamp in gzip header
    // Write at position 4
    fs.writeSync(fd, struct.pack('<L', 0), 0, 1, 4);

    fs.closeSync(fd);
  }

  /**
  * Get file digest and size.
  *
  * @param {String} fileName
  *
  * @returns {Object}
  */
  this.getDigestAndSizeForFile = async function (fileName)
  {
    var chunkSize = 16 * 4 * 1024;

    var fileInfo = fs.statSync(fileName);
    var bufferSize = fileInfo.size;

    var buffer = [];
    await new Promise(function (resolve, reject)
    {
      // Create reader stream and set maximum chunk size
      var infile = fs.createReadStream(fileName, { highWaterMark: chunkSize });
      infile.on('data', function (chunk)
      {
        buffer.push(chunk);
      });
      infile.on('close', function ()
      {
        buffer = Buffer.concat(buffer);
        resolve();
      });
    });

    var hash = crypto.createHash('sha256')
      .update(buffer)
      .digest('base64');

    return {
      digest: hash,
      size: bufferSize
    };
  }
}

exports.file_util = file_util;
