/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

var fs = require('fs');
var path = require('path');
const expandTilde = require('expand-tilde');
const resultStatus = require('./file_util').resultStatus;

/**
 * Creates a local utility object.
 *
 * @returns {Object}
 * @constructor
 */
function local_util()
{
  this.createClient = function (stageInfo, useAccelerateEndpoint)
  {
    return null;
  }

  /**
  * Write file to upload.
  *
  * @param {Object} meta
  *
  * @returns {null}
  */
  this.uploadOneFileWithRetry = async function (meta)
  {
    await new Promise(function (resolve)
    {
      // Create stream object for reader and writer
      var reader = fs.createReadStream(meta['realSrcFilePath']);
      // Create directory if doesn't exist
      if (!fs.existsSync(meta['stageInfo']['location']))
      {
        fs.mkdirSync(meta['stageInfo']['location'], { recursive: true });
      }

      var output = path.join(meta['stageInfo']['location'], meta['dstFileName']);

      // expand '~' and '~user' expressions
      if (process.platform !== "win32")
      {
        output = expandTilde(output);
      }

      var writer = fs.createWriteStream(output);
      // Write file
      var result = reader.pipe(writer);
      result.on('finish', function ()
      {
        resolve();
      });
    });

    meta['dstFileSize'] = meta['uploadSize'];
    meta['resultStatus'] = resultStatus.UPLOADED;
  }

  /**
  * Write file to download.
  *
  * @param {Object} meta
  *
  * @returns {null}
  */
  this.downloadOneFile = async function (meta)
  {
    await new Promise(function (resolve)
    {
      const srcFilePath = expandTilde(meta['stageInfo']['location']);

      // Create stream object for reader and writer
      var realSrcFilePath = path.join(srcFilePath, meta['srcFileName']);
      var reader = fs.createReadStream(realSrcFilePath);

      // Create directory if doesn't exist
      if (!fs.existsSync(meta['localLocation']))
      {
        fs.mkdirSync(meta['localLocation'], { recursive: true });
      }

      var output = path.join(meta['localLocation'], meta['dstFileName']);

      var writer = fs.createWriteStream(output);
      // Write file
      var result = reader.pipe(writer);
      result.on('finish', function ()
      {
        resolve();
      });
    });

    var fileStat = fs.statSync(output)
    meta['dstFileSize'] = fileStat.size;
    meta['resultStatus'] = resultStatus.DOWNLOADED;
  }
}

exports.local_util = local_util;
