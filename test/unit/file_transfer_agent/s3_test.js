/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const mock = require('mock-require');
const SnowflakeS3Util = require('./../../../lib/file_transfer_agent/s3_util').S3Util;
const extractBucketNameAndPath = require('./../../../lib/file_transfer_agent/s3_util').extractBucketNameAndPath;

const resultStatus = require('../../../lib/file_util').resultStatus;

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
      S3: function (config) {
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
          
          this.config = config;
          this.putObject = function () {
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

    AWS = new SnowflakeS3Util(noProxyConnectionConfig, s3, filesystem);
  });

  describe('AWS client endpoint testing', async function () {
    const originalStageInfo = meta.stageInfo;
    const testCases = [
      {
        name: 'when useS3RegionalURL is only enabled',
        stageInfo: {
          ...originalStageInfo,
          useS3RegionalUrl: true,
          endPoint: null,
        },
        result: null
      },
      {
        name: 'when useS3RegionalURL and is enabled and domain starts with cn',
        stageInfo: {
          ...originalStageInfo,
          useS3RegionalUrl: true,
          endPoint: null,
          region: 'cn-mockLocation'
        },
        result: 'https://s3.cn-mockLocation.amazonaws.com.cn'
      },
      {
        name: 'when endPoint is enabled',
        stageInfo: {
          ...originalStageInfo,
          endPoint: 's3.endpoint',
          useS3RegionalUrl: false
        },
        result: 'https://s3.endpoint'
      },
      {
        name: 'when both endPoint and useS3PReiongalUrl is valid',
        stageInfo: {
          ...originalStageInfo,
          endPoint: 's3.endpoint',
          useS3RegionalUrl: true,

        },
        result: 'https://s3.endpoint'
      },
    ];

    testCases.forEach(({ name, stageInfo, result }) => {
      it(name, () => {
        const client = AWS.createClient(stageInfo);
        assert.strictEqual(client.config.endpoint, result);
      } );

    });
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
        }

        return new S3;
      }
    });
    s3 = require('s3');
    const AWS = new SnowflakeS3Util(noProxyConnectionConfig, s3);
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
        }

        return new S3;
      }
    });
    s3 = require('s3');

    const AWS = new SnowflakeS3Util(noProxyConnectionConfig, s3);
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
        }

        return new S3;
      }
    });
    s3 = require('s3');
    const AWS = new SnowflakeS3Util(noProxyConnectionConfig, s3, filesystem);
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
        }

        return new S3;
      }
    });
    s3 = require('s3');
    const AWS = new SnowflakeS3Util(noProxyConnectionConfig, s3, filesystem);
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
    await AWS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
  });

  it('proxy configured', async function () {
    mock('s3', {
      S3: function (config) {
        function S3() {
          this.config = config;
          this.putObject = function () {
          };
        }

        return new S3;
      }
    });
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
    s3 = require('s3');
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
