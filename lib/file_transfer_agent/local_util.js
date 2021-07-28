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
      console.log("testPutDebug upload start");

      const outputPath = expandTilde(meta['stageInfo']['location']);
      // Create directory if doesn't exist
      if (!fs.existsSync(outputPath))
      {
        path.split('/').reduce(
          (directories, directory) =>
          {
            directories += `${directory}/`;

            if (!fs.existsSync(directories))
            {
              fs.mkdirSync(directories);
            }

            return directories;
          },
          '',
        );
        //fs.mkdirSync(meta['stageInfo']['location'], { recursive: true });
        console.log("testPutDebug create directory");
      }

      // Create stream object for reader and writer
      var reader = fs.createReadStream(meta['realSrcFilePath']);
      var output = path.join(outputPath, meta['dstFileName']);

      var writer = fs.createWriteStream(output);
      // Write file
      console.log("testPutDebug write start");
      var result = reader.pipe(writer);
      result.on('finish', function ()
      {
        console.log("testPutDebug write finish");
        resolve();
      });
    });

    meta['dstFileSize'] = meta['uploadSize'];
    meta['resultStatus'] = resultStatus.UPLOADED;

    console.log("testPutDebug upload end");
  }
}

exports.local_util = local_util;
