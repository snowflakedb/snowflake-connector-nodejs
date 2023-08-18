/*
 * Copyright (c) 2021 Snowflake Computing Inc. All rights reserved.
 */

var assert = require('assert');
var mock = require('mock-require');
var SnowflakeGCSUtil = require('./../../../lib/file_transfer_agent/gcs_util');
var resultStatus = require('./../../../lib/file_transfer_agent/file_util').resultStatus;

describe('GCS client', function ()
{
  var mockDataFile = 'mockDataFile';
  var mockLocation = 'mockLocation';
  var mockTable = 'mockTable';
  var mockPath = 'mockPath';
  var mockAccessToken = 'mockAccessToken';
  var mockClient = 'mockClient';
  var mockKey = 'mockKey';
  var mockIv = 'mockIv';
  var mockMatDesc = 'mockMatDesc';
  var mockPresignedUrl = 'mockPresignedUrl';

  var GCS;
  var httpclient;
  var filestream;
  var dataFile = mockDataFile;
  var meta;
  var encryptionMetadata = {
    key: mockKey,
    iv: mockIv,
    matDesc: mockMatDesc
  };

  this.beforeEach(function ()
  {
    meta = {
      stageInfo: {
        location: mockLocation,
        path: mockTable + '/' + mockPath + '/'
      },
      presignedUrl: mockPresignedUrl,
      dstFileName: mockPresignedUrl,
      client: mockClient
    };

    mock('httpclient', {
      put: async function (url, body, header)
      {
        return;
      },
      get: async function (url)
      {
        return;
      },
      head: async function (url, header)
      {
        return {
          headers: ''
        };
      }
    });
    mock('filestream', {
      readFileSync: async function (data)
      {
        return data;
      }
    });
    httpclient = require('httpclient');
    filestream = require('filestream');
    GCS = new SnowflakeGCSUtil(httpclient, filestream);
  });

  it('extract bucket name and path', async function ()
  {
    var GCS = new SnowflakeGCSUtil();

    var result = GCS.extractBucketNameAndPath('sfc-eng-regression/test_sub_dir/');
    assert.strictEqual(result.bucketName, 'sfc-eng-regression');
    assert.strictEqual(result.path, 'test_sub_dir/');

    var result = GCS.extractBucketNameAndPath('sfc-eng-regression/stakeda/test_stg/test_sub_dir/');
    assert.strictEqual(result.bucketName, 'sfc-eng-regression');
    assert.strictEqual(result.path, 'stakeda/test_stg/test_sub_dir/');

    var result = GCS.extractBucketNameAndPath('sfc-eng-regression/');
    assert.strictEqual(result.bucketName, 'sfc-eng-regression');
    assert.strictEqual(result.path, '');

    var result = GCS.extractBucketNameAndPath('sfc-eng-regression//');
    assert.strictEqual(result.bucketName, 'sfc-eng-regression');
    assert.strictEqual(result.path, '/');

    var result = GCS.extractBucketNameAndPath('sfc-eng-regression///');
    assert.strictEqual(result.bucketName, 'sfc-eng-regression');
    assert.strictEqual(result.path, '//');
  });

  it('get file header - success', async function ()
  {
    meta.presignedUrl = '';

    await GCS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
  });

  it('get file header - fail not found file with presigned url', async function ()
  {
    mock('httpclient', {
      put: async function (url, body, header)
      {
        return;
      },
      get: async function (url)
      {
        let err = new Error();
        err.response = { status: 401 };
        throw err;
      }
    });
    var httpclient = require('httpclient');
    var GCS = new SnowflakeGCSUtil(httpclient);

    await GCS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.NOT_FOUND_FILE);
  });

  it('get file header - fail need retry', async function ()
  {
    mock('httpclient', {
      head: async function (url)
      {
        let err = new Error();
        err.response = { status: 403 };
        throw err;
      }
    });
    var httpclient = require('httpclient');
    var GCS = new SnowflakeGCSUtil(httpclient);

    meta.presignedUrl = '';

    await GCS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
  });

  it('get file header - fail not found file without presigned url', async function ()
  {
    mock('httpclient', {
      head: async function (url)
      {
        let err = new Error();
        err.response = { status: 404 };
        throw err;
      }
    });
    var httpclient = require('httpclient');
    var GCS = new SnowflakeGCSUtil(httpclient);

    meta.presignedUrl = '';

    await GCS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.NOT_FOUND_FILE);
  });

  it('get file header - fail expired token', async function ()
  {
    mock('httpclient', {
      head: async function (url, header)
      {
        let err = new Error();
        err.response = { status: 401 };
        throw err;
      }
    });
    var httpclient = require('httpclient');
    var GCS = new SnowflakeGCSUtil(httpclient);

    meta.presignedUrl = '';

    await GCS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('get file header - fail unknown status', async function ()
  {
    var err;
    mock('httpclient', {
      head: async function (url, header)
      {
        err = new Error();
        err.response = { status: 0 };
        throw err;
      }
    });
    var httpclient = require('httpclient');
    var GCS = new SnowflakeGCSUtil(httpclient);

    meta.presignedUrl = '';

    try
    {
      await GCS.getFileHeader(meta, dataFile);
    }
    catch (e)
    {
      assert.strictEqual(e, err);
    }
  });

  it('upload - success', async function ()
  {
    await GCS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
  });

  it('upload - fail need retry', async function ()
  {
    mock('httpclient', {
      put: async function (url, body, header)
      {
        let err = new Error();
        err.code = 403;
        throw err;
      }
    });
    mock('filestream', {
      readFileSync: async function (data)
      {
        return data;
      }
    });
    httpclient = require('httpclient');
    filestream = require('filestream');
    var GCS = new SnowflakeGCSUtil(httpclient, filestream);

    await GCS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
  });

  it('upload - fail renew presigned url', async function ()
  {
    mock('httpclient', {
      put: async function (url, body, header)
      {
        let err = new Error();
        err.code = 400;
        throw err;
      }
    });
    mock('filestream', {
      readFileSync: async function (data)
      {
        return data;
      }
    });
    httpclient = require('httpclient');
    filestream = require('filestream');
    var GCS = new SnowflakeGCSUtil(httpclient, filestream);

    meta.client = '';
    meta.lastError = { code: 0 };

    await GCS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_PRESIGNED_URL);
  });

  it('upload - fail expired token', async function ()
  {
    mock('httpclient', {
      put: async function (url, body, header)
      {
        let err = new Error();
        err.code = 401;
        throw err;
      }
    });
    mock('filestream', {
      readFileSync: async function (data)
      {
        return data;
      }
    });
    mock('gcsClient', {
      bucket: function (bucketName)
      {
        function bucket()
        {
          this.file = function (bucketPath)
          {
            function file()
            {
              this.save = function (fileStream, options)
              {
                let err = new Error();
                err.code = 401;
                throw err;
              }
            }
            return new file;
          }
        }
        return new bucket;
      }
    });
    httpclient = require('httpclient');
    filestream = require('filestream');
    gcsClient = require('gcsClient');
    var GCS = new SnowflakeGCSUtil(httpclient, filestream);

    meta.presignedUrl = '';
    meta.client = { gcsToken: mockAccessToken, gcsClient: gcsClient };

    await GCS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });
});
