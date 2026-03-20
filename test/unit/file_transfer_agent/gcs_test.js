const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const { Readable } = require('stream');
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
    accessUrl: 'http://fakeaccount.snowflakecomputing.com',
    crlValidatorConfig: {
      checkMode: 'DISABLED',
    },
  };

  let GCS;
  let sinonSandbox;
  let httpClient;
  const dataFile = mockDataFile;
  let meta;
  const encryptionMetadata = {
    key: mockKey,
    iv: mockIv,
    matDesc: mockMatDesc,
  };

  beforeEach(() => {
    sinonSandbox = sinon.createSandbox();
    sinonSandbox.stub(fs, 'statSync').returns({ size: 1 });
    sinonSandbox.stub(fs, 'createReadStream').callsFake(() => Readable.from([Buffer.from('mock')]));
    meta = {
      stageInfo: {
        location: mockLocation + '/' + mockTable + '/' + mockPath + '/',
        endPoint: null,
        useRegionalUrl: false,
        region: 'mockLocation',
      },
      presignedUrl: mockPresignedUrl,
      dstFileName: mockPresignedUrl,
      client: mockClient,
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
        fileUrlResult:
          'https://storage.mocklocation.rep.googleapis.com/mockLocation/mockTable/mockPath/mockFile',
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
        fileUrlResult:
          'https://storage.me-central2.rep.googleapis.com/mockLocation/mockTable/mockPath/mockFile',
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
        fileUrlResult:
          'https://storage.me-central2.rep.googleapis.com/mockLocation/mockTable/mockPath/mockFile',
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
        fileUrlResult:
          'https://storage.me-central2.rep.googleapis.com/mockLocation/mockTable/mockPath/mockFile',
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
        fileUrlResult:
          'https://storage.specialEndPoint.rep.googleapis.com/mockLocation/mockTable/mockPath/mockFile',
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
        fileUrlResult:
          'https://storage.specialEndPoint.rep.googleapis.com/mockLocation/mockTable/mockPath/mockFile',
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
        fileUrlResult:
          'https://storage.specialEndPoint.rep.googleapis.com/mockLocation/mockTable/mockPath/mockFile',
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
        fileUrlResult:
          'https://sfc-eng-regression.storage.googleapis.com/stakeda/test_stg/test_sub_dir/mockFile',
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
        fileUrlResult:
          'https://sfc-eng-regression.storage.googleapis.com/stakeda/test_stg/test_sub_dir/mockFile',
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
        fileUrlResult:
          'https://storage.specialEndPoint.rep.googleapis.com/stakeda/test_stg/test_sub_dir/mockFile',
      },
    ];

    testCases.forEach(({ name, stageInfo, fileUrlResult }) => {
      it(name, () => {
        const stageInfoFull = {
          ...meta.stageInfo,
          ...stageInfo,
          creds: { GCS_ACCESS_TOKEN: 'mockToken' },
        };
        const client = GCS.createClient(stageInfoFull);
        assert.ok(client);
        assert.strictEqual(client.gcsToken, 'mockToken');
        assert.strictEqual(GCS.generateFileURL(stageInfoFull, 'mockFile'), fileUrlResult);
      });
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

  it('upload with token uses REST path via httpClient.put', async function () {
    const putSpy = sinon.spy(async () => {});
    httpClient.put = putSpy;
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpClient);

    meta.presignedUrl = '';
    meta.client = { gcsToken: mockAccessToken };
    meta.dstFileName = 'testfile.csv';
    meta.SHA256_DIGEST = 'mockDigest';

    await GCS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
    assert.ok(putSpy.calledOnce, 'httpClient.put should be called');
    const callArgs = putSpy.firstCall.args;
    assert.ok(callArgs[2].headers['Authorization'].startsWith('Bearer '));
  });

  it('download with token uses REST path via httpClient.get', async function () {
    const mockStream = new Readable({
      read() {
        this.push(null);
      },
    });
    const getSpy = sinon.spy(async () => ({
      status: 200,
      headers: {
        'x-goog-meta-sfc-digest': 'mockDigest',
        'content-length': '0',
      },
      data: mockStream,
    }));
    httpClient.get = getSpy;
    sinonSandbox.stub(fs, 'createWriteStream').returns(
      new (require('stream').Writable)({
        write(_chunk, _encoding, cb) {
          cb();
        },
        final(cb) {
          cb();
        },
      }),
    );
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpClient);

    meta.presignedUrl = '';
    meta.client = { gcsToken: mockAccessToken };
    meta.srcFileName = 'testfile.csv';

    await GCS.nativeDownloadFile(meta, '/tmp/testfile.csv');
    assert.strictEqual(meta['resultStatus'], resultStatus.DOWNLOADED);
    assert.ok(getSpy.calledOnce, 'httpClient.get should be called');
    const callArgs = getSpy.firstCall.args;
    assert.ok(callArgs[1].headers['Authorization'].startsWith('Bearer '));
  });

  it('getFileHeader with token uses REST path via httpClient.head', async function () {
    const headSpy = sinon.spy(async () => ({
      headers: {
        'x-goog-meta-sfc-digest': 'mockDigest',
        'content-length': '100',
      },
    }));
    httpClient.head = headSpy;
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpClient);

    meta.presignedUrl = '';
    meta.client = { gcsToken: mockAccessToken };

    const header = await GCS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
    assert.ok(headSpy.calledOnce, 'httpClient.head should be called');
    const callArgs = headSpy.firstCall.args;
    assert.ok(callArgs[1].headers['Authorization'].startsWith('Bearer '));
    assert.strictEqual(header.digest, 'mockDigest');
    assert.strictEqual(header.contentLength, '100');
  });

  it('upload - fail expired token', async function () {
    httpClient.put = async () => {
      const err = new Error();
      err.code = 401;
      throw err;
    };
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpClient);

    meta.presignedUrl = '';
    meta.client = { gcsToken: mockAccessToken };

    await GCS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });
});
