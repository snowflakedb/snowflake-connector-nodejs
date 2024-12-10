/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const mock = require('mock-require');
const SnowflakeGCSUtil = require('./../../../lib/file_transfer_agent/gcs_util');
const GCSUtil = require('./../../../lib/file_transfer_agent/gcs_util');
const resultStatus = require('./../../../lib/file_transfer_agent/file_util').resultStatus;

describe('GCS client', function () {
  const mockDataFile = 'mockDataFile';
  const mockLocation = 'mockLocation';
  const mockTable = 'mockTable';
  const mockPath = 'mockPath';
  const mockAccessToken = 'mockAccessToken';
  const mockClient = 'mockClient';
  const mockKey = 'mockKey';
  const mockIv = 'mockIv';
  const mockMatDesc = 'mockMatDesc';
  const mockPresignedUrl = 'mockPresignedUrl';
  const connectionConfig = {
    proxy: {},
    getProxy: function () {
      return this.proxy;
    },
    getOverrideEnvProxy: function () {
      return true;
    },
    accessUrl: 'http://fakeaccount.snowflakecomputing.com',
  };

  let GCS;
  let httpclient;
  let filestream;
  const dataFile = mockDataFile;
  let meta;
  const encryptionMetadata = {
    key: mockKey,
    iv: mockIv,
    matDesc: mockMatDesc
  };

  this.beforeEach(function () {
    meta = {
      stageInfo: {
        location: mockLocation,
        region: '',
        path: mockTable + '/' + mockPath + '/',
        creds: {
          GCS_ACCESS_TOKEN: 'mockToken'
        }
      },
      presignedUrl: mockPresignedUrl,
      dstFileName: mockPresignedUrl,
      client: mockClient
    };

    mock('httpclient', {
      put: async function () {
        return;
      },
      get: async function () {
        return;
      },
      head: async function () {
        return {
          headers: ''
        };
      }
    });
    mock('filestream', {
      readFileSync: async function (data) {
        return data;
      }
    });
    httpclient = require('httpclient');
    filestream = require('filestream');
    GCS = new SnowflakeGCSUtil(connectionConfig, httpclient, filestream);
  });

  describe('GCS client endpoint testing', async function () {
    const testCases = [
      {
        name: 'when the useRegionalURL is only enabled',
        stageInfo: {
          endPoint: null,
          useRegionalUrl: true,
          region: 'mockLocation',
        },
        result: 'https://storage.mocklocation.rep.googleapis.com'
      },
      {
        name: 'when the region is me-central2',
        stageInfo: {
          endPoint: null,
          useRegionalUrl: false,
          region: 'me-central2'
        },
        result: 'https://storage.me-central2.rep.googleapis.com'
      },
      {
        name: 'when the region is me-central2 (mixed case)',
        stageInfo: {
          endPoint: null,
          useRegionalUrl: false,
          region: 'ME-cEntRal2'
        },
        result: 'https://storage.me-central2.rep.googleapis.com'
      },
      {
        name: 'when the region is me-central2 (uppercase)',
        stageInfo: {
          endPoint: null,
          useRegionalUrl: false,
          region: 'ME-CENTRAL2'
        },
        result: 'https://storage.me-central2.rep.googleapis.com'
      },
      {
        name: 'when the endPoint is specified',
        stageInfo: {
          endPoint: 'https://storage.specialEndPoint.rep.googleapis.com',
          useRegionalUrl: false,
          region: 'ME-cEntRal1'
        },
        result: 'https://storage.specialEndPoint.rep.googleapis.com'
      },
      {
        name: 'when both the endPoint and the useRegionalUrl are specified',
        stageInfo: {
          endPoint: 'https://storage.specialEndPoint.rep.googleapis.com',
          useRegionalUrl: true,
          region: 'ME-cEntRal1'
        },
        result: 'https://storage.specialEndPoint.rep.googleapis.com'
      },
      {
        name: 'when both the endPoint is specified and the region is me-central2',
        stageInfo: {
          endPoint: 'https://storage.specialEndPoint.rep.googleapis.com',
          useRegionalUrl: true,
          region: 'ME-CENTRAL2'
        },
        result: 'https://storage.specialEndPoint.rep.googleapis.com'
      },
    ];

    testCases.forEach(({ name, stageInfo, result }) => {
      it(name, () => {
        const client = GCS.createClient({ ...meta.stageInfo, ...stageInfo });
        assert.strictEqual(client.gcsClient.apiEndpoint, result);
      } );

    });
  });

  it('extract bucket name and path', async function () {
    const GCS = new SnowflakeGCSUtil(connectionConfig);

    let result = GCS.extractBucketNameAndPath('sfc-eng-regression/test_sub_dir/');
    assert.strictEqual(result.bucketName, 'sfc-eng-regression');
    assert.strictEqual(result.path, 'test_sub_dir/');

    result = GCS.extractBucketNameAndPath('sfc-eng-regression/stakeda/test_stg/test_sub_dir/');
    assert.strictEqual(result.bucketName, 'sfc-eng-regression');
    assert.strictEqual(result.path, 'stakeda/test_stg/test_sub_dir/');

    result = GCS.extractBucketNameAndPath('sfc-eng-regression/');
    assert.strictEqual(result.bucketName, 'sfc-eng-regression');
    assert.strictEqual(result.path, '');

    result = GCS.extractBucketNameAndPath('sfc-eng-regression//');
    assert.strictEqual(result.bucketName, 'sfc-eng-regression');
    assert.strictEqual(result.path, '/');

    result = GCS.extractBucketNameAndPath('sfc-eng-regression///');
    assert.strictEqual(result.bucketName, 'sfc-eng-regression');
    assert.strictEqual(result.path, '//');
  });

  it('get file header - success', async function () {
    meta.presignedUrl = '';

    await GCS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
  });

  it('get file header - fail not found file with presigned url', async function () {
    mock('httpclient', {
      put: async function () {
        return;
      },
      get: async function () {
        const err = new Error();
        err.response = { status: 401 };
        throw err;
      }
    });
    const httpclient = require('httpclient');
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpclient);

    await GCS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.NOT_FOUND_FILE);
  });

  it('get file header - fail need retry', async function () {
    mock('httpclient', {
      head: async function () {
        const err = new Error();
        err.response = { status: 403 };
        throw err;
      }
    });
    const httpclient = require('httpclient');
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpclient);

    meta.presignedUrl = '';

    await GCS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
  });

  it('get file header - fail not found file without presigned url', async function () {
    mock('httpclient', {
      head: async function () {
        const err = new Error();
        err.response = { status: 404 };
        throw err;
      }
    });
    const httpclient = require('httpclient');
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpclient);

    meta.presignedUrl = '';

    await GCS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.NOT_FOUND_FILE);
  });

  it('get file header - fail expired token', async function () {
    mock('httpclient', {
      head: async function () {
        const err = new Error();
        err.response = { status: 401 };
        throw err;
      }
    });
    const httpclient = require('httpclient');
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpclient);

    meta.presignedUrl = '';

    await GCS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('get file header - fail unknown status', async function () {
    let err;
    mock('httpclient', {
      head: async function () {
        err = new Error();
        err.response = { status: 0 };
        throw err;
      }
    });
    const httpclient = require('httpclient');
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpclient);

    meta.presignedUrl = '';

    try {
      await GCS.getFileHeader(meta, dataFile);
    } catch (e) {
      assert.strictEqual(e, err);
    }
  });

  it('upload - success', async function () {
    await GCS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
  });

  it('upload - fail need retry', async function () {
    mock('httpclient', {
      put: async function () {
        const err = new Error();
        err.code = 403;
        throw err;
      }
    });
    mock('filestream', {
      readFileSync: async function (data) {
        return data;
      }
    });
    httpclient = require('httpclient');
    filestream = require('filestream');
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpclient, filestream);

    await GCS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
  });

  it('upload - fail renew presigned url', async function () {
    mock('httpclient', {
      put: async function () {
        const err = new Error();
        err.code = 400;
        throw err;
      }
    });
    mock('filestream', {
      readFileSync: async function (data) {
        return data;
      }
    });
    httpclient = require('httpclient');
    filestream = require('filestream');
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpclient, filestream);

    meta.client = '';
    meta.lastError = { code: 0 };

    await GCS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_PRESIGNED_URL);
  });

  it('upload - fail expired token', async function () {
    mock('httpclient', {
      put: async function () {
        const err = new Error();
        err.code = 401;
        throw err;
      }
    });
    mock('filestream', {
      readFileSync: async function (data) {
        return data;
      }
    });
    mock('gcsClient', {
      bucket: function () {
        function bucket() {
          this.file = function () {
            function file() {
              this.save = function () {
                const err = new Error();
                err.code = 401;
                throw err;
              };
            }
            return new file;
          };
        }
        return new bucket;
      }
    });
    httpclient = require('httpclient');
    filestream = require('filestream');
    const gcsClient = require('gcsClient');
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpclient, filestream);

    meta.presignedUrl = '';
    meta.client = { gcsToken: mockAccessToken, gcsClient: gcsClient };

    await GCS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  describe('GCS proxy configuration test', async function () {
    let originalHttpsProxy;
    before(() => {
      originalHttpsProxy = process.env.HTTPS_PROXY;
    });

    after(() => {
      originalHttpsProxy ? process.env.HTTPS_PROXY = originalHttpsProxy : delete process.env.HTTPS_PROXY;
    });
    const testCases = [
      {
        name: 'when both the connection proxy and HTTPS_PROXY are not configured',
        connectionConfig: connectionConfig,
        HTTPS_PROXY: null,
        isOverwriteEnvProxy: false,
        proxyString: null,
      },
      {
        name: 'when HTTPS_PROXY only exists',
        connectionConfig: connectionConfig,
        HTTPS_PROXY: 'https://abc:dfg@snowflake.test.com:2345',
        isOverwriteEnvProxy: false,
        proxyString: null,
      },
      {
        name: 'when the connectionProxy is different from the Env Proxy(HTTPS_PROXY)',
        connectionConfig: { ...connectionConfig,
          proxy: {
            host: 'myproxy.server.com',
            user: 'user',
            password: 'pass',
            port: 1234,
            protocol: 'https:',
            noProxy: undefined,
          },
        },
        HTTPS_PROXY: 'https://abc:dfg@snowflake.test.com:2345',
        isOverwriteEnvProxy: true,
        proxyString: 'https://user:pass@myproxy.server.com:1234',
      },
      {
        name: 'when the connectionProxy and HTTPS_PROXY is the same.',
        connectionConfig: { ...connectionConfig,
          proxy: {
            host: 'myproxy.server.com',
            user: 'user',
            password: 'pass',
            port: 1234,
            protocol: 'https:',
            noProxy: undefined,
          },
        },
        HTTPS_PROXY: 'https://user:pass@myproxy.server.com:1234',
        isOverwriteEnvProxy: false,
        proxyString: null,
      },
      {
        name: 'when the connectionProxy and HTTPS_PROXY are different, but overrideEnvProxy is false.',
        connectionConfig: { ...connectionConfig,
          getOverrideEnvProxy: function () {
            return false;
          },
          proxy: {
            host: 'myproxy.server.com',
            user: 'user',
            password: 'pass',
            port: 1234,
            protocol: 'https:',
            noProxy: undefined,
          },
        },
        HTTPS_PROXY: 'https://abc:dfg@snowflake.test.com:2345',
        isOverwriteEnvProxy: false,
        proxyString: null,
      },
      {
        name: 'when no HTTPS_PROXY, but the connection Proxy exists.',
        connectionConfig: { ...connectionConfig,
          proxy: {
            host: 'myproxy.server.com',
            user: 'user',
            password: 'pass',
            port: 1234,
            protocol: 'https:',
            noProxy: undefined,
          },
        },
        HTTPS_PROXY: null,
        isOverwriteEnvProxy: true,
        proxyString: 'https://user:pass@myproxy.server.com:1234',
      },
      {
        name: 'when the connectionProxy exists, but the noProxy is set with google storage destination.',
        connectionConfig: { ...connectionConfig,
          proxy: {
            host: 'myproxy.server.com',
            user: 'user',
            password: 'pass',
            port: 1234,
            protocol: 'https:',
            noProxy: 'storage.*.rep.googleapis.com',
          },
        },
        HTTPS_PROXY: null,
        isOverwriteEnvProxy: false,
        proxyString: null,
      }, 
    ];

    testCases.forEach(({ name, connectionConfig, HTTPS_PROXY, isOverwriteEnvProxy, proxyString }) => {
      it(name, () => {
        HTTPS_PROXY !== null ? process.env.HTTPS_PROXY = HTTPS_PROXY : delete process.env.HTTPS_PROXY; 
        const GCS = new GCSUtil(connectionConfig);
        GCS.createClient(meta.stageInfo);
        assert.strictEqual(isOverwriteEnvProxy, GCS.getIsEnvProxyOverridden());
        assert.strictEqual(proxyString, GCS.getProxyString());
      });
    });
  });
});