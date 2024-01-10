/*
 * Copyright (c) 2021 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const mock = require('mock-require');
const SnowflakeS3Util = require('./../../../lib/file_transfer_agent/s3_util').S3Util;
const extractBucketNameAndPath = require('./../../../lib/file_transfer_agent/s3_util').extractBucketNameAndPath;

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
  const noProxyConnectionConfig = {
    getProxy: function () {
      return null;
    }
  };

  let AWS;
  let s3;
  let filesystem;
  let meta;
  const dataFile = mockDataFile;
  const encryptionMetadata = {
    key: mockKey,
    iv: mockIv,
    matDesc: mockMatDesc
  };

  before(function () {
    mock('s3', {
      S3: function () {
        function S3() {
          this.getObject = function () {
            function getObject() {
              this.then = function (callback) {
                callback({
                  Metadata: ''
                });
              };
            }

            return new getObject;
          };
          this.putObject = function () {
            function putObject() {
              this.then = function (callback) {
                callback();
              };
            }

            return new putObject;
          };
          this.destroy = function () {
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

    AWS = new SnowflakeS3Util(noProxyConnectionConfig, s3, filesystem);
  });
  beforeEach(function () {
    const stageInfo = {
      location: mockLocation,
      path: mockTable + '/' + mockPath + '/',
      creds: {}
    };
    meta = {
      stageInfo,
      SHA256_DIGEST: mockDigest,
      client: AWS.createClient(stageInfo),
    };
  });
  this.afterEach(function () {
    AWS.destroyClient(meta['client']);
  });

  it('extract bucket name and path', async function () {
    let result = extractBucketNameAndPath('sfc-eng-regression/test_sub_dir/');
    assert.strictEqual(result.bucketName, 'sfc-eng-regression');
    assert.strictEqual(result.s3path, 'test_sub_dir/');

    result = extractBucketNameAndPath('sfc-eng-regression/stakeda/test_stg/test_sub_dir/');
    assert.strictEqual(result.bucketName, 'sfc-eng-regression');
    assert.strictEqual(result.s3path, 'stakeda/test_stg/test_sub_dir/');

    result = extractBucketNameAndPath('sfc-eng-regression/');
    assert.strictEqual(result.bucketName, 'sfc-eng-regression');
    assert.strictEqual(result.s3path, '');

    result = extractBucketNameAndPath('sfc-eng-regression//');
    assert.strictEqual(result.bucketName, 'sfc-eng-regression');
    assert.strictEqual(result.s3path, '/');

    result = extractBucketNameAndPath('sfc-eng-regression///');
    assert.strictEqual(result.bucketName, 'sfc-eng-regression');
    assert.strictEqual(result.s3path, '//');
  });

  it('get file header - success', async function () {
    await AWS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
  });

  it('get file header - fail expired token', async function () {
    mock('s3', {
      S3: function () {
        function S3() {
          this.getObject = function () {
            function getObject() {
              this.then = function () {
                const err = new Error();
                err.Code = 'ExpiredToken';
                throw err;
              };
            }

            return new getObject;
          };
          this.destroy = function () {
          };
        }

        return new S3;
      }
    });
    s3 = require('s3');
    const AWS = new SnowflakeS3Util(noProxyConnectionConfig, s3);
    meta['client'] = AWS.createClient(meta['stageInfo']);

    await AWS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('get file header - fail no such key', async function () {
    mock('s3', {
      S3: function () {
        function S3() {
          this.getObject = function () {
            function getObject() {
              this.then = function () {
                const err = new Error();
                err.Code = 'NoSuchKey';
                throw err;
              };
            }

            return new getObject;
          };
          this.destroy = function () {
          };
        }

        return new S3;
      }
    });
    s3 = require('s3');
    const AWS = new SnowflakeS3Util(noProxyConnectionConfig, s3);
    meta['client'] = AWS.createClient(meta['stageInfo']);

    await AWS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.NOT_FOUND_FILE);
  });

  it('get file header - fail HTTP 400', async function () {
    mock('s3', {
      S3: function () {
        function S3() {
          this.getObject = function () {
            function getObject() {
              this.then = function () {
                const err = new Error();
                err.Code = '400';
                throw err;
              };
            }

            return new getObject;
          };
          this.destroy = function () {
          };
        }

        return new S3;
      }
    });
    s3 = require('s3');
    const AWS = new SnowflakeS3Util(noProxyConnectionConfig, s3);
    meta['client'] = AWS.createClient(meta['stageInfo']);

    await AWS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('get file header - fail unknown', async function () {
    mock('s3', {
      S3: function () {
        function S3() {
          this.getObject = function () {
            function getObject() {
              this.then = function () {
                const err = new Error();
                err.Code = 'unknown';
                throw err;
              };
            }

            return new getObject;
          };
          this.destroy = function () {
          };
        }

        return new S3;
      }
    });
    s3 = require('s3');
    const AWS = new SnowflakeS3Util(noProxyConnectionConfig, s3);
    meta['client'] = AWS.createClient(meta['stageInfo']);

    await AWS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.ERROR);
  });

  it('upload - success', async function () {
    await AWS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
  });

  it('upload - fail expired token', async function () {
    mock('s3', {
      S3: function () {
        function S3() {
          this.putObject = function () {
            function putObject() {
              this.then = function () {
                const err = new Error();
                err.Code = 'ExpiredToken';
                throw err;
              };
            }

            return new putObject;
          };
          this.destroy = function () {
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
    const AWS = new SnowflakeS3Util(noProxyConnectionConfig, s3, filesystem);
    meta['client'] = AWS.createClient(meta['stageInfo']);

    await AWS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('upload - fail wsaeconnaborted', async function () {
    mock('s3', {
      S3: function () {
        function S3() {
          this.putObject = function () {
            function putObject() {
              this.then = function () {
                const err = new Error();
                err.Code = '10053';
                throw err;
              };
            }

            return new putObject;
          };
          this.destroy = function () {
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
    const AWS = new SnowflakeS3Util(noProxyConnectionConfig, s3, filesystem);
    meta['client'] = AWS.createClient(meta['stageInfo']);

    await AWS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY_WITH_LOWER_CONCURRENCY);
  });

  it('upload - fail HTTP 400', async function () {
    mock('s3', {
      S3: function () {
        function S3() {
          this.putObject = function () {
            function putObject() {
              this.then = () => {
                const err = new Error();
                err.Code = '400';
                throw err;
              };
            }

            return new putObject;
          };
          this.destroy = function () {
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
    const AWS = new SnowflakeS3Util(noProxyConnectionConfig, s3, filesystem);
    meta['client'] = AWS.createClient(meta['stageInfo']);

    await AWS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
  });
  it('proxy configured', async function () {
    const proxyOptions = {
      host: '127.0.0.1',
      port: 8080,
      user: 'user',
      password: 'password',
      protocol: 'https'
    };
    const proxyConnectionConfig = {
      accessUrl: 'http://snowflake.com',
      getProxy: function () {
        return proxyOptions;
      }
    };
    const s3 = require('@aws-sdk/client-s3');
    const AWS = new SnowflakeS3Util(proxyConnectionConfig, s3);
    meta['client'] = AWS.createClient(meta['stageInfo']);

    const clientConfig = await meta['client'].config.requestHandler.configProvider;
    assert.equal(clientConfig.httpAgent.options.host, proxyOptions.host);
    assert.equal(clientConfig.httpAgent.options.hostname, 'snowflake.com');
    assert.equal(clientConfig.httpAgent.options.user, proxyOptions.user);
    assert.equal(clientConfig.httpAgent.options.password, proxyOptions.password);
    assert.equal(clientConfig.httpAgent.options.port, proxyOptions.port);

    assert.equal(clientConfig.httpsAgent.options.host, proxyOptions.host);
    assert.equal(clientConfig.httpsAgent.options.hostname, 'snowflake.com');
    assert.equal(clientConfig.httpsAgent.options.user, proxyOptions.user);
    assert.equal(clientConfig.httpsAgent.options.password, proxyOptions.password);
    assert.equal(clientConfig.httpsAgent.options.port, proxyOptions.port);
  });
});
