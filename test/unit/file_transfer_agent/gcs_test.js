/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const mock = require('mock-require');
const SnowflakeGCSUtil = require('./../../../lib/file_transfer_agent/gcs_util');
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
        path: mockTable + '/' + mockPath + '/'
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
    GCS = new SnowflakeGCSUtil(httpclient, filestream);
  });

  describe('AWS client endpoint testing', async function () {
    const originalStageInfo = meta.stageInfo;
    const testCases = [
      {
        name: 'when useRegionalURL is only enabled',
        stageInfo: {
          ...originalStageInfo,
          useRegionalURL: true,
        },
        endPoint: null,
        result: 'storage.mocklocation.rep.googleapis.com'
      },
      {
        name: 'when region is me-central2',
        stageInfo: {
          ...originalStageInfo,
          useRegionalURL: false,
          endPoint: null,
          region: 'me-central2'
        },
        result: 'storage.me-central2.rep.googleapis.com`'
      },
    ];

    testCases.forEach(({ name, stageInfo, result }) => {
      it(name, () => {
        const client = GCS.createClient(stageInfo);
        assert.strictEqual(client.gcsClient.apiEndPoint, result);
      } );

    });
  });

  it('extract bucket name and path', async function () {
    const GCS = new SnowflakeGCSUtil();

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
    const GCS = new SnowflakeGCSUtil(httpclient);

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
    const GCS = new SnowflakeGCSUtil(httpclient);

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
    const GCS = new SnowflakeGCSUtil(httpclient);

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
    const GCS = new SnowflakeGCSUtil(httpclient);

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
    const GCS = new SnowflakeGCSUtil(httpclient);

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
    const GCS = new SnowflakeGCSUtil(httpclient, filestream);

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
    const GCS = new SnowflakeGCSUtil(httpclient, filestream);

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
    const GCS = new SnowflakeGCSUtil(httpclient, filestream);

    meta.presignedUrl = '';
    meta.client = { gcsToken: mockAccessToken, gcsClient: gcsClient };

    await GCS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });
});
