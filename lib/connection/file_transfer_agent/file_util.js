/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

var path = require('path');
var fs = require('fs');
var zlib = require('zlib');
var crypto = require('crypto');

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
  this.compressFileWithGZIP = async function (fileName, tmpDir)
  {
    var baseName = path.basename(fileName);
    var gzipFileName = path.join(tmpDir, baseName + '_c.gz');

    await new Promise(function (resolve, reject)
    {
      var gzip = zlib.createGzip();
      var reader = fs.createReadStream(fileName);
      var writer = fs.createWriteStream(gzipFileName);
      var result = reader.pipe(gzip).pipe(writer);
      result.on('finish', function ()
      {
        resolve();
      });
    });

    var fileInfo = fs.statSync(gzipFileName);

    return {
      name: gzipFileName,
      size: fileInfo.size
    }
  }

  this.getDigestAndSizeForFile = async function (fileName)
  {
    var chunkSize = 16 * 4 * 1024;

    var fileInfo = fs.statSync(fileName);
    var bufferSize = fileInfo.size;
    var buffer = [];

    await new Promise(function (resolve, reject)
    {
      var infile = fs.createReadStream(fileName, { highWaterMark: chunkSize });
      infile.on('data', function (chunk)
      {
        buffer.push(chunk);
      });
      infile.on('close', function ()
      {
        resolve();
      });
    });

    buffer = Buffer.concat(buffer);

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
