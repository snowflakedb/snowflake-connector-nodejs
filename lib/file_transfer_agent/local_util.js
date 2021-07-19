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
      var output = path.join(expandTilde(meta['stageInfo']['location']), meta['dstFileName']);
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
}

module.exports = local_util;
