/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

const AWS = require('aws-sdk');
const EncryptionMetadata = require('./encrypt_util').EncryptionMetadata;
const FileHeader = require('./file_util').FileHeader;

const expandTilde = require('expand-tilde');
const fs = require('fs');
const path = require('path');

const SFC_DIGEST = 'sfc-digest';
const AMZ_MATDESC = "x-amz-matdesc";
const AMZ_KEY = "x-amz-key";
const AMZ_IV = "x-amz-iv";
const ERRORNO_WSAECONNABORTED = 10053;  // network connection was aborted

const EXPIRED_TOKEN = 'ExpiredToken';
const ADDRESSING_STYLE = 'virtual';  // explicit force to use virtual addressing style

const resultStatus = require('./remote_storage_util').resultStatus;

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
 * @returns {Object}
 * @constructor
 */
function s3_util ()
{
  // magic number, given from  error message.
  this.DATA_SIZE_THRESHOLD = 67108864;

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
      region: stageInfo['region'],
      accessKeyId: stageCredentials['AWS_KEY_ID'],
      secretAccessKey: stageCredentials['AWS_SECRET_KEY'],
      sessionToken: securityToken,
      endpoint: endPoint,
      useAccelerateEndpoint: useAccelerateEndpoint
    };

    AWS.config.update(config);

    var s3 = new AWS.S3({
      apiVersion: '2006-03-01',
      signatureVersion: 'v4'
    });

    return s3;
  }

  this.extractBucketNameAndPath = function (stageLocation)
  {
    // expand '~' and '~user' expressions
    stageLocation = expandTilde(stageLocation);

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

  this.getFileHeader = async function (meta, filename)
  {
    var stageInfo = meta['stageInfo'];
    var client = this.createClient(stageInfo);
    var s3location = this.extractBucketNameAndPath(stageInfo['location']);

    var params = {
      Bucket: s3location.bucketName,
      Key: filename
    };

    var akey;

    await client.getObject(params)
      .promise()
      .then(function (data)
      {
        console.log(data);
        akey = data;
      })
      .catch(function (err)
      {
        if (err['code'] == EXPIRED_TOKEN)
        {
          meta['resultStatus'] = resultStatus.RENEW_TOKEN;
          return null;
        }
        else if (err['code'] == '404')
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
          return null
        }
      });

    var encryptionMetadata;
    if (akey.metadata[AMZ_KEY])
    {
      encryptionMetadata = EncryptionMetadata(
        akey.metadata[AMZ_KEY],
        akey.metadata[AMZ_IV],
        akey.metadata[AMZ_MATDESC]
      );
    }

    return FileHeader(
      akey.metadata.get(SFC_DIGEST),
      akey.contentLength,
      encryptionMetadata
    );
  }

  this.uploadFile = async function (dataFile, meta, encryptionMetadata, maxConcurrency)
  {
    var s3Metadata = {
      HTTP_HEADER_CONTENT_TYPE: HTTP_HEADER_VALUE_OCTET_STREAM,
      SFC_DIGEST: meta[SHA256_DIGEST],
    }

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
      Key: path.basename(dataFile),
      Metadata: s3Metadata
    };

    // call S3 to upload file to specified bucket
    await client.upload(params)
      .promise()
      .then(function (data)
      {
        console.log("Upload Success", data.Location);
      })
      .catch(function (err)
      {
        console.log(err, err.stack); // an error occurred
      });

    meta['dstFileSize'] = meta['uploadSize'];
    meta['resultStatus'] = resultStatus.UPLOADED;
  }
}

module.exports = s3_util;
