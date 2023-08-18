/*
 * Copyright (c) 2023 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const mock = require('mock-require');
const SnowflakeAzureUtil = require('./../../../lib/file_transfer_agent/azure_util');
const resultStatus = require('./../../../lib/file_transfer_agent/file_util').resultStatus;

describe('Azure client', function () {
  const mockDataFile = 'mockDataFile';
  const mockLocation = 'mockLocation';
  const mockTable = 'mockTable';
  const mockPath = 'mockPath';
  const mockDigest = 'mockDigest';
  const mockKey = 'mockKey';
  const mockIv = 'mockIv';
  const mockMatDesc = 'mockMatDesc';

  let Azure = null;
  let client = null;
  let filestream = null;
  const dataFile = mockDataFile;
  const meta = {
    stageInfo: {
      location: mockLocation,
      path: mockTable + '/' + mockPath + '/',
      creds: {}
    },
    SHA256_DIGEST: mockDigest,
  };
  const encryptionMetadata = {
    key: mockKey,
    iv: mockIv,
    matDesc: mockMatDesc
  };

  function getClientMock(getPropertiesFn, uploadFn) {
    if (getPropertiesFn !== null) {
      return {
        BlobServiceClient: function() {
          function BlobServiceClient() {
            this.getContainerClient = function () {
              function getContainerClient() {
                this.getBlobClient = function () {
                  function getBlobClient() {
                    this.getProperties = function () {
                      function getProperties() { 
                        this.then = getPropertiesFn;
                      }
                      return new getProperties;
                    };
                  }
                  return new getBlobClient;
                };
              }
              return new getContainerClient;
            };
          }
          return new BlobServiceClient;
        }
      };
    }

    if (uploadFn !== null) {
      return {
        BlobServiceClient: function() {
          function BlobServiceClient() {
            this.getContainerClient = function () {
              function getContainerClient() {
                this.getBlockBlobClient = function () {
                  function getBlockBlobClient() {
                    this.upload = uploadFn;
                  }
                  return new getBlockBlobClient;
                };
              }
              return new getContainerClient;
            };
          }
          return new BlobServiceClient;
        }
      };
    }
  }

  function verifyNameAndPath (bucketPath, containerName, path) {
    const result = Azure.extractContainerNameAndPath(bucketPath);
    assert.strictEqual(result.containerName, containerName);
    assert.strictEqual(result.path, path);
  }

  before(function () {
    mock('client', getClientMock(
      function (callback) {
        callback({
          metadata: {}
        });
      }));

    mock('filestream', {
      readFileSync: async function (data) {
        return data;
      }
    });
    
    client = require('client');
    filestream = require('filestream');
    Azure = new SnowflakeAzureUtil(client, filestream);
  });

  it('extract bucket name and path', async function () {
    verifyNameAndPath('sfc-eng-regression/test_sub_dir/', 'sfc-eng-regression', 'test_sub_dir/');
    verifyNameAndPath('sfc-eng-regression/stakeda/test_stg/test_sub_dir/', 'sfc-eng-regression', 'stakeda/test_stg/test_sub_dir/');
    verifyNameAndPath('sfc-eng-regression/', 'sfc-eng-regression', '');
    verifyNameAndPath('sfc-eng-regression//', 'sfc-eng-regression', '/');
    verifyNameAndPath('sfc-eng-regression///', 'sfc-eng-regression', '//');
  });

  it('get file header - success', async function () {
    await Azure.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
  });

  it('get file header - fail expired token', async function () {
    mock('client', getClientMock(
      function () {
        const err = new Error();
        err.code = 'ExpiredToken';
        throw err;
      }, null));

    client = require('client');
    Azure = new SnowflakeAzureUtil(client);

    await Azure.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('get file header - fail HTTP 400', async function () {
    mock('client', getClientMock(
      function () {
        const err = new Error();
        err.statusCode = '404';
        throw err;
      }, null));

    client = require('client');
    const Azure = new SnowflakeAzureUtil(client);

    await Azure.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.NOT_FOUND_FILE);
  });

  it('get file header - fail HTTP 400', async function () {
    mock('client', getClientMock(
      function () {
        const err = new Error();
        err.statusCode = '400';
        throw err;
      }, null));

    client = require('client');
    Azure = new SnowflakeAzureUtil(client);

    await Azure.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('get file header - fail unknown', async function () { 
    mock('client', getClientMock(
      function () {
        const err = new Error();
        err.code = 'unknown';
        throw err;
      }, null));

    client = require('client');
    Azure = new SnowflakeAzureUtil(client);

    await Azure.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.ERROR);
  });

  it('upload - success', async function () {
    mock('client', getClientMock (
      null,
      function () {
        function upload() {}
        return new upload;
      }));
    
    client = require('client');
    filestream = require('filestream');
    Azure = new SnowflakeAzureUtil(client, filestream);

    await Azure.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
  });

  it('upload - fail expired token', async function () {
    mock('client', getClientMock (
      null,
      function () {
        function upload() {
          const err = new Error('Server failed to authenticate the request.');
          err.statusCode = '403';
          throw err;
        }
        return new upload;
      }));
    
    client = require('client');
    filestream = require('filestream');
    Azure = new SnowflakeAzureUtil(client, filestream);

    await Azure.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('upload - fail HTTP 400', async function () {
    mock('client', getClientMock (
      null,
      function () {
        function upload() {
          const err = new Error();
          err.statusCode = '400';
          throw err;
        }
        return new upload;
      }));
    
    client = require('client');
    filestream = require('filestream');
    Azure = new SnowflakeAzureUtil(client, filestream);

    await Azure.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
  });
});
