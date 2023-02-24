/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

var fs = require('fs');
var path = require('path');
var SnowflakeS3Util = require('./s3_util');
var SnowflakeAzureUtil = require('./azure_util');
var SnowflakeGCSUtil = require('./gcs_util');

var SnowflakeEncryptionUtil = new (require('./encrypt_util').encrypt_util)();
var resultStatus = require('./file_util').resultStatus;

const DEFAULT_CONCURRENCY = 1
const DEFAULT_MAX_RETRY = 5

// File Encryption Material
function SnowflakeFileEncryptionMaterial(key, qid, smkid)
{
    var smkidString = "" + smkid;
  return {
    "queryStageMasterKey": key, // query stage master key
    "queryId": qid, // query id
    "smkId": smkidString  // SMK id
  }
}

exports.SnowflakeFileEncryptionMaterial = SnowflakeFileEncryptionMaterial;

function NeedRenewTokenError(Exception)
{
  return;
}

/**
 * Creates a remote storage utility object.
 *
 * @returns {Object}
 * @constructor
 */
function remote_storage_util()
{
  /**
  * Get storage type based on location type.
  *
  * @param {String} type
  *
  * @returns {Object}
  */
  this.getForStorageType = function (type)
  {
    if (type == 'S3')
    {
      return new SnowflakeS3Util();
    }
    else if (type == 'AZURE')
    {
      return new SnowflakeAzureUtil();
    }
    else if (type == 'GCS')
    {
      return new SnowflakeGCSUtil();
    }
    else
    {
      return null;
    }
  }

  /**
  * Create the client based on the location type.
  *
  * @param {Object} stageInfo
  * @param {Boolean} useAccelerateEndpoint
  *
  * @returns {Object}
  */
  this.createClient = function (stageInfo, useAccelerateEndpoint = false)
  {
    var utilClass = this.getForStorageType(stageInfo['locationType']);
    return utilClass.createClient(stageInfo, useAccelerateEndpoint);
  }

  /**
  * Encrypt then upload one file.
  *
  * @param {Object} meta
  *
  * @returns {null}
  */
  this.uploadOneFile = async function (meta)
  {
    var encryptionMetadata;
    var dataFile;

    if (meta['encryptionMaterial'])
    {
      var result = await SnowflakeEncryptionUtil.encryptFile(
        meta['encryptionMaterial'],
        meta['realSrcFilePath'],
        meta['tmpDir']);
      encryptionMetadata = result.encryptionMetadata;
      dataFile = result.dataFile;
    }
    else
    {
      dataFile = meta['realSrcFilePath'];
    }

    var utilClass = this.getForStorageType(meta['stageInfo']['locationType']);

    var maxConcurrency = meta['parallel'];
    var lastErr;
    var maxRetry = DEFAULT_MAX_RETRY;

    for (var retry = 0; retry < maxRetry; retry++)
    {
      if (!meta['overwrite'])
      {
        var fileHeader = await utilClass.getFileHeader(meta, meta['dstFileName'])

        if (fileHeader && meta['resultStatus'] == resultStatus.UPLOADED)
        {
          // File already exists
          meta['dstFileSize'] = 0;
          meta['resultStatus'] = resultStatus.SKIPPED;
          return;
        }
      }
      if (meta['overwrite'] || meta['resultStatus'] === resultStatus.NOT_FOUND_FILE)
      {
        await utilClass.uploadFile(
          dataFile,
          meta,
          encryptionMetadata,
          maxConcurrency);
      }

      if (meta['resultStatus'] == resultStatus.UPLOADED)
      {
        return;
      }
      else if (meta['resultStatus'] == resultStatus.RENEW_TOKEN)
      {
        return;
      }
      else if (meta['resultStatus'] == resultStatus.RENEW_PRESIGNED_URL)
      {
        return;
      }
      else if (meta['resultStatus'] == resultStatus.NEED_RETRY)
      {
        lastErr = meta['lastError'];
        // Failed to upload file, retrying
        if (!meta['noSleepingTime'])
        {
          var sleepingTime = Math.min(Math.pow(2, retry), 16);
          await new Promise(resolve => setTimeout(resolve, sleepingTime));
        }
      }
      else if (meta['resultStatus'] == resultStatus.NEED_RETRY_WITH_LOWER_CONCURRENCY)
      {
        lastErr = meta['lastError'];
        // Failed to upload file, retrying with max concurrency
        maxConcurrency = meta['parallel'] - parseInt(retry * meta['parallel'] / maxRetry);
        maxConcurrency = Math.max(DEFAULT_CONCURRENCY, maxConcurrency);
        meta['lastMaxConcurrency'] = maxConcurrency;

        if (!meta['noSleepingTime'])
        {
          var sleepingTime = Math.min(Math.pow(2, retry), 16);
          await new Promise(resolve => setTimeout(resolve, sleepingTime));
        }
      }
    }
    if (lastErr)
    {
      throw new Error(lastErr);
    }
    else
    {
      var msg = "Unknown Error in uploading a file: " + dataFile;
      throw new Error(msg);
    }
  }

  /**
  * Attempt upload of a file and retry if fails.
  *
  * @param {Object} meta
  *
  * @returns {null}
  */
  this.uploadOneFileWithRetry = async function (meta)
  {
    var utilClass = this.getForStorageType(meta['stageInfo']['locationType']);

    var breakFlag = false;
    for (var x = 0; x < 10; x++)
    {
      await this.uploadOneFile(meta);

      if (meta['resultStatus'] == resultStatus.UPLOADED)
      {
        for (var y = 0; y < 10; y++)
        {
          await utilClass.getFileHeader(meta, meta['dstFileName']);
          if (meta['resultStatus'] == resultStatus.NOT_FOUND_FILE)
          {
            // Wait 1 second
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }
          break;
        }
      }
      breakFlag = true;
      break;
    }
    if (!breakFlag)
    {
      // Could not upload a file even after retry
      meta['resultStatus'] = resultStatus.ERROR;
    }
  }

  /**
  * Download a file.
  *
  * @param {Object} meta
  *
  * @returns {null}
  */
  this.downloadOneFile = async function (meta)
  {
    // Downloads a file from S3
    var fullDstPath = meta['localLocation'];
    await new Promise((resolve, reject) =>
    {
      fs.realpath(fullDstPath, (err, basePath) =>
      {
        if (err) reject(err);
        fullDstPath = path.join(basePath, path.basename(meta['dstFileName']));
        resolve();
      });
    });

    // TODO: validate fullDstPath is under the writable directory
    var baseDir = path.dirname(fullDstPath);
    await new Promise((resolve) =>
    {
      fs.exists(baseDir, (exists) =>
      {
        if (!exists)
        {
          fs.mkdir(baseDir, () =>
          {
            resolve();
          });
        }
        else
        {
          resolve();
        }
      });
    });

    var utilClass = this.getForStorageType(meta['stageInfo']['locationType']);
    var fileHeader = await utilClass.getFileHeader(meta, meta['srcFileName']);

    if (fileHeader)
    {
      meta['srcFileSize'] = fileHeader.contentLength;
    }

    var maxConcurrency = meta['parallel'];
    var lastErr;
    var maxRetry = DEFAULT_MAX_RETRY;

    for (var retry = 0; retry < maxRetry; retry++)
    {
      // Download the file
      await utilClass.nativeDownloadFile(meta, fullDstPath, maxConcurrency);

      if (meta['resultStatus'] == resultStatus.DOWNLOADED)
      {
        if (meta['encryptionMaterial'])
        {
          /**
            * For storage utils that do not have the privilege of
            * getting the metadata early, both object and metadata
            * are downloaded at once.In which case, the file meta will
            * be updated with all the metadata that we need and
            * then we can call getFileHeader to get just that and also
            * preserve the idea of getting metadata in the first place.
            * One example of this is the utils that use presigned url
            * for upload / download and not the storage client library.
            **/
          if (meta['presignedUrl'])
          {
            fileHeader = await utilClass.getFileHeader(meta, meta['srcFilePath'])
          }

          var tmpDstName = await SnowflakeEncryptionUtil.decryptFile(
            fileHeader.encryptionMetadata,
            meta['encryptionMaterial'],
            fullDstPath,
            meta['tmpDir']);

          // Copy decrypted tmp file to target destination path
          await new Promise((resolve, reject) =>
          {
            fs.copyFile(tmpDstName, fullDstPath, async (err) =>
            {
              if (err) reject(err);
              resolve();
            });
          });

          // Delete tmp file
          await new Promise((resolve, reject) => {
            fs.unlink(tmpDstName, (err) =>
            {
              if (err) reject(err);
              resolve();
            });
          });

          // Delete tmp folder
          await new Promise((resolve, reject) =>
          {
            fs.rmdir(meta['tmpDir'], (err) =>
            {
              if (err)
              {
                reject(err);
              }
              resolve();
            });
          });
        }
        await new Promise((resolve) =>
        {
          fs.stat(fullDstPath, (err, stat) =>
          {
            meta['dstFileSize'] = stat.size;
            resolve();
          });
        });

        return;
      }
      else if (meta['resultStatus'] == resultStatus.RENEW_TOKEN)
      {
        return;
      }
      else if (meta['resultStatus'] == resultStatus.RENEW_PRESIGNED_URL)
      {
        return;
      }
      else if (meta['resultStatus'] == resultStatus.NEED_RETRY_WITH_LOWER_CONCURRENCY)
      {
        lastErr = meta['lastError'];
        // Failed to download file, retrying with max concurrency
        maxConcurrency = meta['parallel'] - parseInt(retry * meta['parallel'] / maxRetry);
        maxConcurrency = Math.max(DEFAULT_CONCURRENCY, maxConcurrency);
        meta['lastMaxConcurrency'] = maxConcurrency;

        if (!meta['noSleepingTime'])
        {
          var sleepingTime = Math.min(Math.pow(2, retry), 16);
          await new Promise(resolve => setTimeout(resolve, sleepingTime));
        }
      }
      else if (meta['resultStatus'] == resultStatus.NEED_RETRY)
      {
        lastErr = meta['lastError'];
        // Failed to download file, retrying
        if (!meta['noSleepingTime'])
        {
          var sleepingTime = Math.min(Math.pow(2, retry), 16);
          await new Promise(resolve => setTimeout(resolve, sleepingTime));
        }
      }        
    }
    if (lastErr)
    {
      throw new Error(lastErr);
    }
    else
    {
      var msg = "Unknown Error in uploading a file: " + dataFile;
      throw new Error(msg);
    }
  }  
}

exports.remote_storage_util = remote_storage_util;
