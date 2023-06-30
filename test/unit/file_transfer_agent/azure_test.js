/*
 * Copyright (c) 2023 Snowflake Computing Inc. All rights reserved.
 */

var assert = require('assert');
var mock = require('mock-require');
var SnowflakeAzureUtil = require('./../../../lib/file_transfer_agent/azure_util');
var resultStatus = require('./../../../lib/file_transfer_agent/file_util').resultStatus;

describe('AZ client', function ()
{
  var mockDataFile = 'mockDataFile';
  var mockLocation = 'mockLocation';
  var mockTable = 'mockTable';
  var mockPath = 'mockPath';
  var mockDigest = 'mockDigest';
  var mockKey = 'mockKey';
  var mockIv = 'mockIv';
  var mockMatDesc = 'mockMatDesc';

  var AZ;
  var azure;
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
    mock('azure', {
      BlobServiceClient: function()
      {
        function BlobServiceClient()
        {
          this.getContainerClient = function (params)
          {
            function getContainerClient()
            {
              this.getBlobClient = function (params)
              {
                function getBlobClient()
                {
                  this.getProperties = function (params)
                  {
                    function getProperties()
                    { 
                      this.then = function (callback)
                      {
                        callback({
                          metadata: {}
                        });
                      }
                    }
                    return new getProperties;
                  }
                }
                return new getBlobClient;
              }
            }
            return new getContainerClient;
          }
        }
        return new BlobServiceClient;
      }
    });

    mock('filestream', {
      readFileSync: async function (data)
      {
        return data;
      }
    });
    
    azure = require('azure');
    filestream = require('filestream');
    AZ = new SnowflakeAzureUtil(azure, filestream);
  });

  it('extract bucket name and path', async function ()
  {
    var result = AZ.extractContainerNameAndPath('sfc-dev1-regression/test_sub_dir/');
    assert.strictEqual(result.containerName, 'sfc-dev1-regression');
    assert.strictEqual(result.path, 'test_sub_dir/');

    var result = AZ.extractContainerNameAndPath('sfc-dev1-regression/stakeda/test_stg/test_sub_dir/');
    assert.strictEqual(result.containerName, 'sfc-dev1-regression');
    assert.strictEqual(result.path, 'stakeda/test_stg/test_sub_dir/');

    var result = AZ.extractContainerNameAndPath('sfc-dev1-regression/');
    assert.strictEqual(result.containerName, 'sfc-dev1-regression');
    assert.strictEqual(result.path, '');

    var result = AZ.extractContainerNameAndPath('sfc-dev1-regression//');
    assert.strictEqual(result.containerName, 'sfc-dev1-regression');
    assert.strictEqual(result.path, '/');

    var result = AZ.extractContainerNameAndPath('sfc-dev1-regression///');
    assert.strictEqual(result.containerName, 'sfc-dev1-regression');
    assert.strictEqual(result.path, '//');
  });

  it('get file header - success', async function ()
  {
    await AZ.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
  });

  it('get file header - fail expired token', async function ()
  {
    mock('azure', {
      BlobServiceClient: function()
      {
        function BlobServiceClient()
        {
          this.getContainerClient = function (params)
          {
            function getContainerClient()
            {
              this.getBlobClient = function (params)
              {
                function getBlobClient()
                {
                  this.getProperties = function (params)
                  {
                    function getProperties()
                    { 
                      this.then = function (callback)
                      {
                        let err = new Error();
                        err.code = 'ExpiredToken';
                        throw err;
                      }
                    }
                    return new getProperties;
                  }
                }
                return new getBlobClient;
              }
            }
            return new getContainerClient;
          }
        }
        return new BlobServiceClient;
      }
    });
    azure = require('azure');
    var AZ = new SnowflakeAzureUtil(azure);

    await AZ.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('get file header - fail HTTP 400', async function ()
  {
    mock('azure', {
      BlobServiceClient: function()
      {
        function BlobServiceClient()
        {
          this.getContainerClient = function (params)
          {
            function getContainerClient()
            {
              this.getBlobClient = function (params)
              {
                function getBlobClient()
                {
                  this.getProperties = function (params)
                  {
                    function getProperties()
                    { 
                      this.then = function (callback)
                      {
                        let err = new Error();
                        err.statusCode = '404';
                        throw err;
                      }
                    }
                    return new getProperties;
                  }
                }
                return new getBlobClient;
              }
            }
            return new getContainerClient;
          }
        }
        return new BlobServiceClient;
      }
    });
    azure = require('azure');
    var AZ = new SnowflakeAzureUtil(azure);

    await AZ.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.NOT_FOUND_FILE);
  });

  it('get file header - fail HTTP 400', async function ()
  {
    mock('azure', {
      BlobServiceClient: function()
      {
        function BlobServiceClient()
        {
          this.getContainerClient = function (params)
          {
            function getContainerClient()
            {
              this.getBlobClient = function (params)
              {
                function getBlobClient()
                {
                  this.getProperties = function (params)
                  {
                    function getProperties()
                    { 
                      this.then = function (callback)
                      {
                        let err = new Error();
                        err.statusCode = '400';
                        throw err;
                      }
                    }
                    return new getProperties;
                  }
                }
                return new getBlobClient;
              }
            }
            return new getContainerClient;
          }
        }
        return new BlobServiceClient;
      }
    });
    azure = require('azure');
    var AZ = new SnowflakeAzureUtil(azure);

    await AZ.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('get file header - fail unknown', async function ()
  {
    mock('azure', {
      BlobServiceClient: function()
      {
        function BlobServiceClient()
        {
          this.getContainerClient = function (params)
          {
            function getContainerClient()
            {
              this.getBlobClient = function (params)
              {
                function getBlobClient()
                {
                  this.getProperties = function (params)
                  {
                    function getProperties()
                    { 
                      this.then = function (callback)
                      {
                        let err = new Error();
                        err.code = 'unknown';
                        throw err;
                      }
                    }
                    return new getProperties;
                  }
                }
                return new getBlobClient;
              }
            }
            return new getContainerClient;
          }
        }
        return new BlobServiceClient;
      }
    });
    azure = require('azure');
    var AZ = new SnowflakeAzureUtil(azure);

    await AZ.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.ERROR);
  });

  it('upload - success', async function ()
  {
    mock('azure', {
      BlobServiceClient: function()
      {
        function BlobServiceClient()
        {
          this.getContainerClient = function (params)
          {
            function getContainerClient()
            {
              this.getBlockBlobClient = function (params)
              {
                function getBlockBlobClient()
                {
                  this.upload = function (params)
                  {
                    function upload() {}
                    return new upload;
                  }
                }
                return new getBlockBlobClient;
              }
            }
            return new getContainerClient;
          }
        }
        return new BlobServiceClient;
      }
    });

    mock('filestream', {
      readFileSync: async function (data)
      {
        return data;
      }
    });
    
    azure = require('azure');
    filestream = require('filestream');
    AZ = new SnowflakeAzureUtil(azure, filestream);

    await AZ.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
  });

  it('upload - fail expired token', async function ()
  {
    mock('azure', {
      BlobServiceClient: function()
      {
        function BlobServiceClient()
        {
          this.getContainerClient = function (params)
          {
            function getContainerClient()
            {
              this.getBlockBlobClient = function (params)
              {
                function getBlockBlobClient()
                {
                  this.upload = function (params)
                  {
                    function upload() 
                    {
                      let err = new Error('Server failed to authenticate the request.');
                      err.statusCode = '403';
                      throw err;
                    }
                    return new upload;
                  }
                }
                return new getBlockBlobClient;
              }
            }
            return new getContainerClient;
          }
        }
        return new BlobServiceClient;
      }
    });

    mock('filestream', {
      readFileSync: async function (data)
      {
        return data;
      }
    });
    
    azure = require('azure');
    filestream = require('filestream');
    AZ = new SnowflakeAzureUtil(azure, filestream);

    await AZ.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('upload - fail HTTP 400', async function ()
  {
    mock('azure', {
      BlobServiceClient: function()
      {
        function BlobServiceClient()
        {
          this.getContainerClient = function (params)
          {
            function getContainerClient()
            {
              this.getBlockBlobClient = function (params)
              {
                function getBlockBlobClient()
                {
                  this.upload = function (params)
                  {
                    function upload() 
                    {
                      let err = new Error();
                      err.statusCode = '400';
                      throw err;
                    }
                    return new upload;
                  }
                }
                return new getBlockBlobClient;
              }
            }
            return new getContainerClient;
          }
        }
        return new BlobServiceClient;
      }
    });

    mock('filestream', {
      readFileSync: async function (data)
      {
        return data;
      }
    });
    
    azure = require('azure');
    filestream = require('filestream');
    AZ = new SnowflakeAzureUtil(azure, filestream);

    await AZ.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
  });
});
