const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const SnowflakeGCSUtil = require('./../../../lib/file_transfer_agent/gcs_util');
const resultStatus = require('../../../lib/file_util').resultStatus;

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
    getHTTPHeadersCustomizers: () => [],
    accessUrl: 'http://fakeaccount.snowflakecomputing.com',
  };

  let GCS;
  let sinonSandbox;
  let httpClient;
  const dataFile = mockDataFile;
  let meta;
  const encryptionMetadata = {
    key: mockKey,
    iv: mockIv,
    matDesc: mockMatDesc
  };

  beforeEach(() => {
    sinonSandbox = sinon.createSandbox();
    sinonSandbox.stub(fs, 'readFileSync').returnsArg(0);
    meta = {
      stageInfo: {
        location: mockLocation + '/' + mockTable + '/' + mockPath + '/',
        endPoint: null,
        useRegionalUrl: false,
        region: 'mockLocation',
      },
      presignedUrl: mockPresignedUrl,
      dstFileName: mockPresignedUrl,
      client: mockClient
    };
    httpClient = {
      put: async () => {},
      get: async () => {},
      head: async () => ({ headers: '' }),
    };
    GCS = new SnowflakeGCSUtil(connectionConfig, httpClient);
  });

  afterEach(() => {
    sinonSandbox.restore();
  });

  describe('GCS client endpoint testing', async function () {
    const testCases = [
      {
        name: 'when the useRegionalURL is only enabled',
        stageInfo: {
          endPoint: null,
          useRegionalUrl: true,
          region: 'mockLocation',
          useVirtualUrl: false,
        },
        endPointResult: 'https://storage.mocklocation.rep.googleapis.com',
        fileUrlResult: 'https://storage.mocklocation.rep.googleapis.com/mockLocation/mockTable/mockPath/mockFile'
      },
      {
        name: 'when the region is me-central2',
        stageInfo: {
          endPoint: null,
          useRegionalUrl: false,
          region: 'me-central2',
          useVirtualUrl: false,
        },
        endPointResult: 'https://storage.me-central2.rep.googleapis.com',
        fileUrlResult: 'https://storage.me-central2.rep.googleapis.com/mockLocation/mockTable/mockPath/mockFile'

      },
      {
        name: 'when the region is me-central2 (mixed case)',
        stageInfo: {
          endPoint: null,
          useRegionalUrl: false,
          region: 'ME-cEntRal2',
          useVirtualUrl: false,
        },
        endPointResult: 'https://storage.me-central2.rep.googleapis.com',
        fileUrlResult: 'https://storage.me-central2.rep.googleapis.com/mockLocation/mockTable/mockPath/mockFile'

      },
      {
        name: 'when the region is me-central2 (uppercase)',
        stageInfo: {
          endPoint: null,
          useRegionalUrl: false,
          region: 'ME-CENTRAL2',
          useVirtualUrl: false,
        },
        endPointResult: 'https://storage.me-central2.rep.googleapis.com',
        fileUrlResult: 'https://storage.me-central2.rep.googleapis.com/mockLocation/mockTable/mockPath/mockFile'
      },
      {
        name: 'when the endPoint is specified',
        stageInfo: {
          endPoint: 'https://storage.specialEndPoint.rep.googleapis.com',
          useRegionalUrl: false,
          region: 'ME-cEntRal1',
          useVirtualUrl: false,
        },
        endPointResult: 'https://storage.specialEndPoint.rep.googleapis.com',
        fileUrlResult: 'https://storage.specialEndPoint.rep.googleapis.com/mockLocation/mockTable/mockPath/mockFile'
      },
      {
        name: 'when both the endPoint and the useRegionalUrl are specified',
        stageInfo: {
          endPoint: 'https://storage.specialEndPoint.rep.googleapis.com',
          useRegionalUrl: true,
          region: 'ME-cEntRal1',
          useVirtualUrl: false,
        },
        endPointResult: 'https://storage.specialEndPoint.rep.googleapis.com',
        fileUrlResult: 'https://storage.specialEndPoint.rep.googleapis.com/mockLocation/mockTable/mockPath/mockFile'

      },
      {
        name: 'when both the endPoint is specified and the region is me-central2',
        stageInfo: {
          endPoint: 'https://storage.specialEndPoint.rep.googleapis.com',
          useRegionalUrl: true,
          region: 'ME-CENTRAL2',
          useVirtualUrl: false,
        },
        endPointResult: 'https://storage.specialEndPoint.rep.googleapis.com',
        fileUrlResult: 'https://storage.specialEndPoint.rep.googleapis.com/mockLocation/mockTable/mockPath/mockFile'
      },
      {
        name: 'when only the useVirtualUrl is enabled',
        stageInfo: {
          location: 'sfc-eng-regression/stakeda/test_stg/test_sub_dir/',
          endPoint: null,
          useRegionalUrl: false,
          region: 'ME-WEST',
          UseRegionalURL: false,
          useVirtualUrl: true,
        },
        endPointResult: 'https://sfc-eng-regression.storage.googleapis.com',
        fileUrlResult: 'https://sfc-eng-regression.storage.googleapis.com/stakeda/test_stg/test_sub_dir/mockFile'

      },
      {
        name: 'when both the useRegionalURL and useVirtualUrl are enabled',
        stageInfo: {
          location: 'sfc-eng-regression/stakeda/test_stg/test_sub_dir/',
          endPoint: null,
          useRegionalUrl: true,
          region: 'ME-WEST',
          UseRegionalURL: false,
          useVirtualUrl: true,
        },
        endPointResult: 'https://sfc-eng-regression.storage.googleapis.com',
        fileUrlResult: 'https://sfc-eng-regression.storage.googleapis.com/stakeda/test_stg/test_sub_dir/mockFile'
      },
      {
        name: 'when all the options are enabled',
        stageInfo: {
          location: 'sfc-eng-regression/stakeda/test_stg/test_sub_dir/',
          endPoint: 'storage.specialEndPoint.rep.googleapis.com',
          useRegionalUrl: true,
          region: 'ME-CENTRAL2',
          useVirtualUrl: true,
        },
        endPointResult: 'https://storage.specialEndPoint.rep.googleapis.com',
        fileUrlResult: 'https://storage.specialEndPoint.rep.googleapis.com/stakeda/test_stg/test_sub_dir/mockFile'
      },
    ];

    testCases.forEach(({ name, stageInfo, endPointResult, fileUrlResult }) => {
      it(name, () => {
        const client = GCS.createClient({ ...meta.stageInfo, ...stageInfo,  creds: { GCS_ACCESS_TOKEN: 'mockToken' } });
        assert.strictEqual(client.gcsClient.apiEndpoint, endPointResult);
        assert.strictEqual(GCS.generateFileURL({ ...meta.stageInfo, ...stageInfo,  creds: { GCS_ACCESS_TOKEN: 'mockToken' } }, 'mockFile'), fileUrlResult);
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
    httpClient.get = async () => {
      const err = new Error();
      err.response = { status: 401 };
      throw err;
    };
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpClient);

    await GCS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.NOT_FOUND_FILE);
  });

  it('get file header - fail need retry', async function () {
    httpClient.head = async () => {
      const err = new Error();
      err.response = { status: 403 };
      throw err;
    };
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpClient);

    meta.presignedUrl = '';

    await GCS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
  });

  it('get file header - fail not found file without presigned url', async function () {
    httpClient.head = async () => {
      const err = new Error();
      err.response = { status: 404 };
      throw err;
    };
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpClient);

    meta.presignedUrl = '';

    await GCS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.NOT_FOUND_FILE);
  });

  it('get file header - fail expired token', async function () {
    httpClient.head = async () => {
      const err = new Error();
      err.response = { status: 401 };
      throw err;
    };
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpClient);

    meta.presignedUrl = '';

    await GCS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('get file header - fail unknown status', async function () {
    const err = new Error();
    err.response = { status: 0 };
    httpClient.head = async () => {
      throw err;
    };
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpClient);

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
    httpClient.put = async () => {
      const err = new Error();
      err.code = 403;
      throw err;
    };
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpClient);

    await GCS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
  });

  it('upload - fail renew presigned url', async function () {
    httpClient.put = async () => {
      const err = new Error();
      err.code = 400;
      throw err;
    };
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpClient);

    meta.client = '';
    meta.lastError = { code: 0 };

    await GCS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_PRESIGNED_URL);
  });

  it('upload - fail expired token', async function () {
    httpClient.put = async () => {
      const err = new Error();
      err.code = 401;
      throw err;
    };
    const gcsClient = {
      bucket: () => ({
        file: () => ({
          save: () => {
            const err = new Error();
            err.code = 401;
            throw err;
          }
        })
      })
    };
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpClient);

    meta.presignedUrl = '';
    meta.client = { gcsToken: mockAccessToken, gcsClient: gcsClient };

    await GCS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('upload - isRetry flags', async function () {
    httpClient.put = async () => {
      const err = new Error();
      err.code = 403;
      throw err;
    };
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpClient);

    await GCS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);

  });
});
