/*
 * Copyright (c) 2021 Snowflake Computing Inc. All rights reserved.
 */

var assert = require('assert');
var mock = require('mock-require');
var SnowflakeS3Util = require('./../../../lib/file_transfer_agent/s3_util');
var resultStatus = require('./../../../lib/file_transfer_agent/file_util').resultStatus;

describe('S3 client', function ()
{
  var mockDataFile = 'mockDataFile';
  var mockLocation = 'mockLocation';
  var mockTable = 'mockTable';
  var mockPath = 'mockPath';
  var mockDigest = 'mockDigest';
  var mockKey = 'mockKey';
  var mockIv = 'mockIv';
  var mockMatDesc = 'mockMatDesc';

  var AWS;
  var s3;
  var filesystem;
  var dataFile = mockDataFile;
  var meta = {
    stageInfo: {
      location: mockLocation,
      path: mockTable + '/' + mockPath + '/',
      creds: {}
    },
    SHA256_DIGEST: mockDigest,
  };
  var encryptionMetadata = {
    key: mockKey,
    iv: mockIv,
    matDesc: mockMatDesc
  };

  before(function ()
  {
    mock('S3Client', {
      S3Client: function ()
      {
        function S3Client()
        {
          this.send = function (metadata)
          {
            function send()
            {
              return metadata;
            }
            return new send;
          }
        }
        return new S3Client;
      }
    });
    mock('GetObjectCommand', {
      GetObjectCommand: function ()
      {
        function GetObjectCommand()
        {
          return { Metadata: '' };
        }
        return new GetObjectCommand;
      }
    });
    mock('Upload', {
      Upload: function ()
      {
        function Upload()
        {
          this.done = function ()
          {
            function done()
            {
              return;
            }
            return new done;
          }
        }
        return new Upload;
      }
    });
    mock('filesystem', {
      readFileSync: async function (data)
      {
        return data;
      }
    });

    s3 = require('S3Client');
    get = require('GetObjectCommand');
    upload = require('Upload');
    filesystem = require('filesystem');

    AWS = new SnowflakeS3Util(s3, get, upload, filesystem);
  });

  it('extract bucket name and path', async function ()
  {
    var result = AWS.extractBucketNameAndPath('sfc-dev1-regression/test_sub_dir/');
    assert.strictEqual(result.bucketName, 'sfc-dev1-regression');
    assert.strictEqual(result.s3path, 'test_sub_dir/');

    var result = AWS.extractBucketNameAndPath('sfc-dev1-regression/stakeda/test_stg/test_sub_dir/');
    assert.strictEqual(result.bucketName, 'sfc-dev1-regression');
    assert.strictEqual(result.s3path, 'stakeda/test_stg/test_sub_dir/');

    var result = AWS.extractBucketNameAndPath('sfc-dev1-regression/');
    assert.strictEqual(result.bucketName, 'sfc-dev1-regression');
    assert.strictEqual(result.s3path, '');

    var result = AWS.extractBucketNameAndPath('sfc-dev1-regression//');
    assert.strictEqual(result.bucketName, 'sfc-dev1-regression');
    assert.strictEqual(result.s3path, '/');

    var result = AWS.extractBucketNameAndPath('sfc-dev1-regression///');
    assert.strictEqual(result.bucketName, 'sfc-dev1-regression');
    assert.strictEqual(result.s3path, '//');
  });

  it('get file header - success', async function ()
  {
    await AWS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
  });

  it('get file header - fail expired token', async function ()
  {
    mock('S3Client', {
      S3Client: function ()
      {
        function S3Client()
        {
          this.send = function ()
          {
            function send()
            {
              let err = new Error();
              err.code = 'ExpiredToken';
              throw err;
            }
            return new send;
          }
        }
        return new S3Client;
      }
    });
    s3 = require('S3Client');
    var AWS = new SnowflakeS3Util(s3);

    await AWS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('get file header - fail no such key', async function ()
  {
    mock('S3Client', {
      S3Client: function ()
      {
        function S3Client()
        {
          this.send = function ()
          {
            function send()
            {
              let err = new Error();
              err.code = 'NoSuchKey';
              throw err;
            }
            return new send;
          }
        }
        return new S3Client;
      }
    });
    s3 = require('S3Client');
    var AWS = new SnowflakeS3Util(s3);

    await AWS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.NOT_FOUND_FILE);
  });

  it('get file header - fail HTTP 400', async function ()
  {
    mock('S3Client', {
      S3Client: function ()
      {
        function S3Client()
        {
          this.send = function ()
          {
            function send()
            {
              let err = new Error();
              err.code = '400';
              throw err;
            }
            return new send;
          }
        }
        return new S3Client;
      }
    });
    s3 = require('S3Client');
    var AWS = new SnowflakeS3Util(s3);

    await AWS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('get file header - fail unknown', async function ()
  {
    mock('S3Client', {
      S3Client: function ()
      {
        function S3Client()
        {
          this.send = function ()
          {
            function send()
            {
              let err = new Error();
              err.code = 'unknown';
              throw err;
            }
            return new send;
          }
        }
        return new S3Client;
      }
    });
    s3 = require('S3Client');
    var AWS = new SnowflakeS3Util(s3);

    await AWS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.ERROR);
  });

  it('upload - success', async function ()
  {
    await AWS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
  });

  it('upload - fail expired token', async function ()
  {
    mock('S3Client', {
      S3Client: function ()
      {
        function S3Client() {}
        return new S3Client;
      }
    });
    mock('Upload', {
      Upload: function ()
      {
        function Upload()
        {
          this.done = function ()
          {
            function done()
            {
              let err = new Error();
              err.code = 'ExpiredToken';
              throw err;
            }
            return new done;
          }
        }
        return new Upload;
      }
    });
    mock('filesystem', {
      readFileSync: async function (data)
      {
        return data;
      }
    });
    s3 = require('S3Client');
    upload = require('Upload');
    filesystem = require('filesystem');
    var AWS = new SnowflakeS3Util(s3, {}, upload, filesystem);

    await AWS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('upload - fail wsaeconnaborted', async function ()
  {
    mock('S3Client', {
      S3Client: function ()
      {
        function S3Client() { }
        return new S3Client;
      }
    });
    mock('Upload', {
      Upload: function ()
      {
        function Upload()
        {
          this.done = function ()
          {
            function done()
            {
              let err = new Error();
              err.code = '10053';
              throw err;
            }
            return new done;
          }
        }
        return new Upload;
      }
    });
    mock('filesystem', {
      readFileSync: async function (data)
      {
        return data;
      }
    });
    s3 = require('S3Client');
    upload = require('Upload');
    filesystem = require('filesystem');
    var AWS = new SnowflakeS3Util(s3, {}, upload, filesystem);

    await AWS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY_WITH_LOWER_CONCURRENCY);
  });

  it('upload - fail HTTP 400', async function ()
  {
    mock('S3Client', {
      S3Client: function ()
      {
        function S3Client() { }
        return new S3Client;
      }
    });
    mock('Upload', {
      Upload: function ()
      {
        function Upload()
        {
          this.done = function ()
          {
            function done()
            {
              let err = new Error();
              err.code = '400';
              throw err;
            }
            return new done;
          }
        }
        return new Upload;
      }
    });
    mock('filesystem', {
      readFileSync: async function (data)
      {
        return data;
      }
    });
    s3 = require('S3Client');
    upload = require('Upload');
    filesystem = require('filesystem');
    var AWS = new SnowflakeS3Util(s3, {}, upload, filesystem);

    await AWS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
  });
});
