/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

const EncryptionMetadata = require('./encrypt_util').EncryptionMetadata;
const FileHeader = require('./file_util').FileHeader;

const expandTilde = require('expand-tilde');

const AMZ_IV = "x-amz-iv";
const AMZ_KEY = "x-amz-key";
const AMZ_MATDESC = "x-amz-matdesc";
const SFC_DIGEST = 'sfc-digest';

const EXPIRED_TOKEN = 'ExpiredToken';
const NO_SUCH_KEY= 'NoSuchKey';

const ERRORNO_WSAECONNABORTED = 10053;  // network connection was aborted

const resultStatus = require('./file_util').resultStatus;

const HTTP_HEADER_VALUE_OCTET_STREAM = 'application/octet-stream';

// S3 Location: S3 bucket name + path
function S3Location(bucketName, s3path)
{
  return {
    "bucketName": bucketName, // S3 bucket name
    "s3path": s3path // S3 path name
  }
}

/**
 * Creates an S3 utility object.
 * 
 * @param {module} s3
 * @param {module} filestream
 * 
 * @returns {Object}
 * @constructor
 */
function s3_util(s3, filestream)
{
  const AWS = typeof s3 !== "undefined" ? s3 : require('aws-sdk');
  const fs = typeof filestream !== "undefined" ? filestream : require('fs');

  // magic number, given from  error message.
  this.DATA_SIZE_THRESHOLD = 67108864;

  /**
  * Create an AWS S3 client using an AWS token.
  *
  * @param {Object} stageInfo
  *
  * @returns {String}
  */
  this.createClient = function (stageInfo, useAccelerateEndpoint)
  {
    var stageCredentials = stageInfo['creds'];
    var securityToken = stageCredentials['AWS_TOKEN'];

    // if GS sends us an endpoint, it's likely for FIPS. Use it.
    var endPoint = null;
    if (stageInfo['endPoint'])
    {
      endPoint = 'https://' + stageInfo['endPoint'];
    }

    var config = {
      apiVersion: '2006-03-01',
      signatureVersion: 'v4',
      region: stageInfo['region'],
      accessKeyId: stageCredentials['AWS_KEY_ID'],
      secretAccessKey: stageCredentials['AWS_SECRET_KEY'],
      sessionToken: securityToken,
      endpoint: endPoint,
      useAccelerateEndpoint: useAccelerateEndpoint
    };

    var s3 = new AWS.S3(config);

    return s3;
  }

  /**
  * Extract the bucket name and path from the metadata's stage location.
  *
  * @param {String} stageLocation
  *
  * @returns {Object}
  */
  this.extractBucketNameAndPath = function (stageLocation)
  {
    // expand '~' and '~user' expressions
    if (process.platform !== "win32")
    {
      stageLocation = expandTilde(stageLocation);
    }

    var bucketName = stageLocation;
    var s3path;

    // split stage location as bucket name and path
    if (stageLocation.includes('/'))
    {
      bucketName = stageLocation.substring(0, stageLocation.indexOf('/'));

      s3path = stageLocation.substring(stageLocation.indexOf('/') + 1, stageLocation.length);
      if (s3path && !s3path.endsWith('/'))
      {
        s3path += '/';
      }
    }
    return S3Location(bucketName, s3path);
  }

  /**
  * Create file header based on file being uploaded or not.
  *
  * @param {Object} meta
  * @param {String} filename
  *
  * @returns {Object}
  */
  this.getFileHeader = async function (meta, filename)
  {
    var stageInfo = meta['stageInfo'];
    var client = this.createClient(stageInfo);
    var s3location = this.extractBucketNameAndPath(stageInfo['location']);

    var params = {
      Bucket: s3location.bucketName,
      Key: s3location.s3path + filename
    };

    var akey;

    try
    {
      await client.getObject(params)
        .promise()
        .then(function (data)
        {
          akey = data;
        })
    }
    catch (err)
    {
      if (err['code'] == EXPIRED_TOKEN)
      {
        meta['resultStatus'] = resultStatus.RENEW_TOKEN;
        return null;
      }
      else if (err['code'] == NO_SUCH_KEY)
      {
        meta['resultStatus'] = resultStatus.NOT_FOUND_FILE;
        return FileHeader(null, null, null);
      }
      else if (err['code'] == '400')
      {
        meta['resultStatus'] = resultStatus.RENEW_TOKEN;
        return null;
      }
      else
      {
        meta['resultStatus'] = resultStatus.ERROR;
        return null;
      }
    }

    meta['resultStatus'] = resultStatus.UPLOADED;

    var encryptionMetadata;
    if (akey && akey.Metadata[AMZ_KEY])
    {
      encryptionMetadata = EncryptionMetadata(
        akey.Metadata[AMZ_KEY],
        akey.Metadata[AMZ_IV],
        akey.Metadata[AMZ_MATDESC]
      );
    }

    return FileHeader(
      akey.Metadata[SFC_DIGEST],
      akey.ContentLength,
      encryptionMetadata
    );
  }

  /**
  * Create the file metadata then upload the file.
  *
  * @param {String} dataFile
  * @param {Object} meta
  * @param {Object} encryptionMetadata
  * @param {Number} maxConcurrency
  *
  * @returns {null}
  */
  this.uploadFile = async function (dataFile, meta, encryptionMetadata, maxConcurrency)
  {
    var s3Metadata = {
      HTTP_HEADER_CONTENT_TYPE: HTTP_HEADER_VALUE_OCTET_STREAM,
      SFC_DIGEST: meta['SHA256_DIGEST']
    };

    if (encryptionMetadata)
    {
      s3Metadata[AMZ_IV] = encryptionMetadata.iv;
      s3Metadata[AMZ_KEY] = encryptionMetadata.key;
      s3Metadata[AMZ_MATDESC] = encryptionMetadata.matDesc;
    }

    var stageInfo = meta['stageInfo'];
    var client = this.createClient(stageInfo);

    var s3location = this.extractBucketNameAndPath(meta['stageInfo']['location']);

    var fileStream = fs.readFileSync(dataFile);

    var params = {
      Bucket: s3location.bucketName,
      Body: fileStream,
      Key: s3location.s3path + meta['dstFileName'],
      Metadata: s3Metadata
    };

    // call S3 to upload file to specified bucket
    try
    {
      await client.upload(params)
        .promise();
    }
    catch (err)
    {
      if (err['code'] == EXPIRED_TOKEN)
      {
        meta['resultStatus'] = resultStatus.RENEW_TOKEN;
      }
      else
      {
        meta['lastError'] = err;
        if (err['code'] == ERRORNO_WSAECONNABORTED)
        {
          meta['resultStatus'] = resultStatus.NEED_RETRY_WITH_LOWER_CONCURRENCY;
        }
        else
        {
          meta['resultStatus'] = resultStatus.NEED_RETRY;
        }
      }
      return;
    }

    meta['dstFileSize'] = meta['uploadSize'];
    meta['resultStatus'] = resultStatus.UPLOADED;
  }

  /**
   * Download the file.
   *
   * @param {String} dataFile
   * @param {Object} meta
   * @param {Object} encryptionMetadata
   * @param {Number} maxConcurrency
   *
   * @returns {null}
   */
  this.nativeDownloadFile = async function (meta, fullDstPath, maxConcurrency)
  {
    var stageInfo = meta['stageInfo'];
    var client = this.createClient(stageInfo);

    var s3location = this.extractBucketNameAndPath(meta['stageInfo']['location']);

    var params = {
      Bucket: s3location.bucketName,
      Key: s3location.s3path + meta['dstFileName'],
    };

    // call S3 to download file to specified bucket
    try
    {
      await client.getObject(params)
        .promise()
        .then((data) =>
        {
          return new Promise((resolve, reject) =>
          {
            fs.writeFile(fullDstPath, data.Body, 'binary', (err) =>
            {
              if (err) reject(err);
              resolve();
            });
          });
        });
    }
    catch (err)
    {
      if (err['code'] == EXPIRED_TOKEN)
      {
        meta['resultStatus'] = resultStatus.RENEW_TOKEN;
      }
      else
      {
        meta['lastError'] = err;
        if (err['code'] == ERRORNO_WSAECONNABORTED)
        {
          meta['resultStatus'] = resultStatus.NEED_RETRY_WITH_LOWER_CONCURRENCY;
        }
        else
        {
          meta['resultStatus'] = resultStatus.NEED_RETRY;
        }
      }
      return;
    }
    meta['resultStatus'] = resultStatus.DOWNLOADED;
  }
}

module.exports = s3_util;
