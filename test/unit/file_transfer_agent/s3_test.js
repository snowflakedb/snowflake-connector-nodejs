/*
 * Copyright (c) 2021 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const mock = require('mock-require');
const SnowflakeS3Util = require('./../../../lib/file_transfer_agent/s3_util');
const resultStatus = require('./../../../lib/file_transfer_agent/file_util').resultStatus;

describe('S3 client', function () {
  const mockDataFile = 'mockDataFile';
  const mockLocation = 'mockLocation';
  const mockTable = 'mockTable';
  const mockPath = 'mockPath';
  const mockDigest = 'mockDigest';
  const mockKey = 'mockKey';
  const mockIv = 'mockIv';
  const mockMatDesc = 'mockMatDesc';

  let AWS;
  let s3;
  let filesystem;
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

  before(function () {
    mock('s3', {
      S3: function (params) {
        function S3 () {
          this.getObject = function (params) {
            function getObject () {
              this.then = function (callback) {
                callback({
                  Metadata: ''
                });
              };
            }

            return new getObject;
          };
          this.putObject = function (params) {
            function putObject() {
              this.then = function (callback) {
                callback();
              };
            }

            return new putObject;
          };
        }

        return new S3;
      }
    });
    mock('filesystem', {
      readFileSync: async function (data) {
        return data;
      }
    });
    s3 = require('s3');
    filesystem = require('filesystem');

    AWS = new SnowflakeS3Util(s3, filesystem);
  });

  it('extract bucket name and path', async function () {
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

  it('get file header - success', async function () {
    await AWS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
  });

  it('get file header - fail expired token', async function () {
    mock('s3', {
      S3: function (params) {
        function S3 () {
          this.getObject = function (params) {
            function getObject () {
              this.then = function (callback) {
                const err = new Error();
                err.Code = 'ExpiredToken';
                throw err;
              };
            }

            return new getObject;
          };
        }

        return new S3;
      }
    });
    s3 = require('s3');
    const AWS = new SnowflakeS3Util(s3);

    await AWS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('get file header - fail no such key', async function () {
    mock('s3', {
      S3: function (params) {
        function S3 () {
          this.getObject = function (params) {
            function getObject () {
              this.then = function (callback) {
                const err = new Error();
                err.Code = 'NoSuchKey';
                throw err;
              };
            }

            return new getObject;
          };
        }

        return new S3;
      }
    });
    s3 = require('s3');
    const AWS = new SnowflakeS3Util(s3);

    await AWS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.NOT_FOUND_FILE);
  });

  it('get file header - fail HTTP 400', async function () {
    mock('s3', {
      S3: function (params) {
        function S3 () {
          this.getObject = function (params) {
            function getObject () {
              this.then = function (callback) {
                const err = new Error();
                err.Code = '400';
                throw err;
              };
            }

            return new getObject;
          };
        }

        return new S3;
      }
    });
    s3 = require('s3');
    const AWS = new SnowflakeS3Util(s3);

    await AWS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('get file header - fail unknown', async function () {
    mock('s3', {
      S3: function (params) {
        function S3 () {
          this.getObject = function (params) {
            function getObject () {
              this.then = function (callback) {
                const err = new Error();
                err.Code = 'unknown';
                throw err;
              };
            }

            return new getObject;
          };
        }

        return new S3;
      }
    });
    s3 = require('s3');
    const AWS = new SnowflakeS3Util(s3);

    await AWS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.ERROR);
  });

  it('upload - success', async function () {
    await AWS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
  });

  it('upload - fail expired token', async function () {
    mock('s3', {
      S3: function (params) {
        function S3 () {
          this.putObject = function (params) {
            function putObject () {
              this.then = function () {
                const err = new Error();
                err.Code = 'ExpiredToken';
                throw err;
              };
            }

            return new putObject;
          };
        }

        return new S3;
      }
    });
    mock('filesystem', {
      readFileSync: async function (data) {
        return data;
      }
    });
    s3 = require('s3');
    filesystem = require('filesystem');
    const AWS = new SnowflakeS3Util(s3, filesystem);

    await AWS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('upload - fail wsaeconnaborted', async function () {
    mock('s3', {
      S3: function (params) {
        function S3 () {
          this.putObject = function (params) {
            function putObject () {
              this.then = function () {
                const err = new Error();
                err.Code = '10053';
                throw err;
              };
            }

            return new putObject;
          };
        }

        return new S3;
      }
    });
    mock('filesystem', {
      readFileSync: async function (data) {
        return data;
      }
    });
    s3 = require('s3');
    filesystem = require('filesystem');
    const AWS = new SnowflakeS3Util(s3, filesystem);

    await AWS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY_WITH_LOWER_CONCURRENCY);
  });

  it('upload - fail HTTP 400', async function () {
    mock('s3', {
      S3: function (params) {
        function S3 () {
          this.putObject = function (params) {
            function putObject () {
              this.then = () => {
                const err = new Error();
                err.Code = '400';
                throw err;
              };
            }

            return new putObject;
          };
        }

        return new S3;
      }
    });
    mock('filesystem', {
      readFileSync: async function (data) {
        return data;
      }
    });
    s3 = require('s3');
    filesystem = require('filesystem');
    const AWS = new SnowflakeS3Util(s3, filesystem);

    await AWS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
  });
});
