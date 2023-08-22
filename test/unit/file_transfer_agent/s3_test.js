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
    mock('s3', {
      S3: function (params)
      {
        function S3()
        {
          this.send = function (command)
          {
            function send()
            {
              return {
                Metadata: ''
              };
            }
            return new send;
          };
        }
        return new S3;
      },
      GetObjectCommand: function (params)
      {
        function GetObjectCommand()
        {
          return;
        }
        return new GetObjectCommand;
      },
      PutObjectCommand: function (params)
      {
        function PutObjectCommand()
        {
          return;
        }
        return new PutObjectCommand;
      }
    });
    mock('filesystem', {
      readFileSync: async function (data)
      {
        return data;
      }
    });
    s3 = require('s3');
    filesystem = require('filesystem');

    AWS = new SnowflakeS3Util(s3, filesystem);
  });

  it('extract bucket name and path', async function ()
  {
    var result = AWS.extractBucketNameAndPath('sfc-eng-regression/test_sub_dir/');
    assert.strictEqual(result.bucketName, 'sfc-eng-regression');
    assert.strictEqual(result.s3path, 'test_sub_dir/');

    var result = AWS.extractBucketNameAndPath('sfc-eng-regression/stakeda/test_stg/test_sub_dir/');
    assert.strictEqual(result.bucketName, 'sfc-eng-regression');
    assert.strictEqual(result.s3path, 'stakeda/test_stg/test_sub_dir/');

    var result = AWS.extractBucketNameAndPath('sfc-eng-regression/');
    assert.strictEqual(result.bucketName, 'sfc-eng-regression');
    assert.strictEqual(result.s3path, '');

    var result = AWS.extractBucketNameAndPath('sfc-eng-regression//');
    assert.strictEqual(result.bucketName, 'sfc-eng-regression');
    assert.strictEqual(result.s3path, '/');

    var result = AWS.extractBucketNameAndPath('sfc-eng-regression///');
    assert.strictEqual(result.bucketName, 'sfc-eng-regression');
    assert.strictEqual(result.s3path, '//');
  });

  it('get file header - success', async function ()
  {
    await AWS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
  });

  it('get file header - fail expired token', async function ()
  {
    mock('s3', {
      S3: function (params)
      {
        function S3()
        {
          this.send = function (command)
          {
            function send()
            {
              let err = new Error();
              err['Code'] = 'ExpiredToken';
              throw err;
            }
            return new send;
          };
        }
        return new S3;
      },
      GetObjectCommand: function (params)
      {
        function GetObjectCommand()
        {
          return;
        }
        return new GetObjectCommand;
      }
    });
    s3 = require('s3');
    var AWS = new SnowflakeS3Util(s3);

    await AWS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('get file header - fail no such key', async function ()
  {
    mock('s3', {
      S3: function (params)
      {
        function S3()
        {
          this.send = function (command)
          {
            function send()
            {
              let err = new Error();
              err['Code'] = 'NoSuchKey';
              throw err;
            }
            return new send;
          };
        }
        return new S3;
      },
      GetObjectCommand: function (params)
      {
        function GetObjectCommand()
        {
          return;
        }
        return new GetObjectCommand;
      }
    });
    s3 = require('s3');
    var AWS = new SnowflakeS3Util(s3);

    await AWS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.NOT_FOUND_FILE);
  });

  it('get file header - fail HTTP 400', async function ()
  {

    mock('s3', {
      S3: function (params)
      {
        function S3()
        {
          this.send = function (command)
          {
            function send()
            {
              let err = new Error();
              err['Code'] = '400';
              throw err;
            }
            return new send;
          };
        }
        return new S3;
      },
      GetObjectCommand: function (params)
      {
        function GetObjectCommand()
        {
          return;
        }
        return new GetObjectCommand;
      }
    });
    s3 = require('s3');
    var AWS = new SnowflakeS3Util(s3);

    await AWS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('get file header - fail unknown', async function ()
  {
    mock('s3', {
      S3: function (params)
      {
        function S3()
        {
          this.send = function (command)
          {
            function send()
            {
              let err = new Error();
              err['Code'] = 'unknown';
              throw err;
            }
            return new send;
          };
        }
        return new S3;
      },
      GetObjectCommand: function (params)
      {
        function GetObjectCommand()
        {
          return;
        }
        return new GetObjectCommand;
      }
    });
    s3 = require('s3');
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
    mock('s3', {
      S3: function (params)
      {
        function S3()
        {
          this.send = function (command)
          {
            function send()
            {
              let err = new Error();
              err['Code'] = 'ExpiredToken';
              throw err;
            }
            return new send;
          };
        }
        return new S3;
      },
      PutObjectCommand: function (params)
      {
        function PutObjectCommand()
        {
          return;
        }
        return new PutObjectCommand;
      }
    });
    mock('filesystem', {
      readFileSync: async function (data)
      {
        return data;
      }
    });
    s3 = require('s3');
    filesystem = require('filesystem');
    var AWS = new SnowflakeS3Util(s3, filesystem);

    await AWS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('upload - fail wsaeconnaborted', async function ()
  {
    mock('s3', {
      S3: function (params)
      {
        function S3()
        {
          this.send = function (command)
          {
            function send()
            {
              let err = new Error();
              err['Code'] = '10053';
              throw err;
            }
            return new send;
          };
        }
        return new S3;
      },
      PutObjectCommand: function (params)
      {
        function PutObjectCommand()
        {
          return;
        }
        return new PutObjectCommand;
      }
    });
    mock('filesystem', {
      readFileSync: async function (data)
      {
        return data;
      }
    });
    s3 = require('s3');
    filesystem = require('filesystem');
    var AWS = new SnowflakeS3Util(s3, filesystem);

    await AWS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY_WITH_LOWER_CONCURRENCY);
  });

  it('upload - fail HTTP 400', async function ()
  {
    mock('s3', {
      S3: function (params)
      {
        function S3()
        {
          this.send = function (command)
          {
            function send()
            {
              let err = new Error();
              err['Code'] = '400';
              throw err;
            }
            return new send;
          };
        }
        return new S3;
      },
      PutObjectCommand: function (params)
      {
        function PutObjectCommand()
        {
          return;
        }
        return new PutObjectCommand;
      }
    });
    mock('filesystem', {
      readFileSync: async function (data)
      {
        return data;
      }
    });
    s3 = require('s3');
    filesystem = require('filesystem');
    var AWS = new SnowflakeS3Util(s3, filesystem);

    await AWS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
  });
});
