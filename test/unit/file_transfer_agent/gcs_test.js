const assert = require('assert');
const sinon = require('sinon');
const fs = require('fs');
const { Readable } = require('stream');
const snowflake = require('./../../../lib/snowflake').default;
const SnowflakeGCSUtil = require('./../../../lib/file_transfer_agent/gcs_util');
const resultStatus = require('../../../lib/file_util').resultStatus;
const { MULTIPART_PART_SIZE_BYTES } = require('../../../lib/file_transfer_agent/multipart');
const { fakeFileHandle, MULTIPART_FILE_SIZE } = require('./multipart_test_utils');

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

  const dataFile = mockDataFile;
  let meta;
  const encryptionMetadata = {
    key: mockKey,
    iv: mockIv,
    matDesc: mockMatDesc,
  };

  function mockGCS(methods = {}) {
    const httpClient = Object.assign(
      {
        put: async () => {},
        get: async () => {},
        head: async () => ({ headers: '' }),
      },
      methods,
    );
    return new SnowflakeGCSUtil(connectionConfig, httpClient);
  }

  function stubFs(fileSize = 4) {
    sinon.stub(fs, 'statSync').returns({ size: fileSize });
    sinon.stub(fs, 'createReadStream').callsFake(() => Readable.from([Buffer.from('mock')]));
    sinon.stub(fs.promises, 'stat').resolves({ size: fileSize });
    sinon.stub(fs.promises, 'readFile').resolves(Buffer.alloc(fileSize, 0));
    sinon.stub(fs.promises, 'open').callsFake(async () => fakeFileHandle(fileSize));
  }

  beforeEach(() => {
    // TODO: make this a builder function instead of initializing for each test
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
  });

  afterEach(() => {
    sinon.restore();
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
        const GCS = mockGCS();
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
    const GCS = mockGCS();
    meta.presignedUrl = '';

    await GCS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
  });

  it('get file header - fail not found file with presigned url', async function () {
    const GCS = mockGCS({
      get: async () => {
        const err = new Error();
        err.response = { status: 401 };
        throw err;
      },
    });

    await GCS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.NOT_FOUND_FILE);
  });

  it('get file header - fail need retry', async function () {
    const GCS = mockGCS({
      head: async () => {
        const err = new Error();
        err.response = { status: 403 };
        throw err;
      },
    });
    meta.presignedUrl = '';

    await GCS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
  });

  it('get file header - fail not found file without presigned url', async function () {
    const GCS = mockGCS({
      head: async () => {
        const err = new Error();
        err.response = { status: 404 };
        throw err;
      },
    });
    meta.presignedUrl = '';

    await GCS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.NOT_FOUND_FILE);
  });

  it('get file header - fail expired token', async function () {
    const GCS = mockGCS({
      head: async () => {
        const err = new Error();
        err.response = { status: 401 };
        throw err;
      },
    });
    meta.presignedUrl = '';

    await GCS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('get file header - fail unknown status', async function () {
    const err = new Error();
    err.response = { status: 0 };
    const GCS = mockGCS({
      head: async () => {
        throw err;
      },
    });
    meta.presignedUrl = '';

    try {
      await GCS.getFileHeader(meta, dataFile);
    } catch (e) {
      assert.strictEqual(e, err);
    }
  });

  it('upload - success', async function () {
    stubFs();
    const GCS = mockGCS();
    await GCS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
  });

  describe('Multipart upload', () => {
    before(() => {
      snowflake.configure({ enableExperimentalMultipartUploads: true });
    });

    after(() => {
      snowflake.configure({ enableExperimentalMultipartUploads: false });
    });

    // Points meta at the access-token (resumable) path and sizes the upload.
    function useAccessTokenUpload(fileSize) {
      meta.presignedUrl = '';
      meta.client = { gcsToken: mockAccessToken };
      meta.uploadSize = fileSize;
    }

    it('sends Buffer body to axios.put (not a Readable) when file is smaller than multipart threshold', async () => {
      stubFs();
      const put = sinon.stub().resolves();
      const GCS = mockGCS({ put });

      await GCS.uploadFile(dataFile, meta, encryptionMetadata);

      assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
      assert.strictEqual(put.callCount, 1);
      const [, body, options] = put.firstCall.args;
      assert.ok(Buffer.isBuffer(body), 'axios.put body must be a Buffer, not a Readable');
      assert.strictEqual(options.headers['Content-Length'], body.length);
    });

    it('uploads large file via single Buffer PUT on legacy presigned-URL path', async () => {
      stubFs(MULTIPART_FILE_SIZE);
      const put = sinon.stub().resolves();
      const GCS = mockGCS({ put });

      await GCS.uploadFile(dataFile, meta, encryptionMetadata);

      assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
      assert.strictEqual(put.callCount, 1);
      const [, body, options] = put.firstCall.args;
      assert.ok(Buffer.isBuffer(body));
      assert.strictEqual(body.length, MULTIPART_FILE_SIZE);
      assert.strictEqual(options.headers['Content-Length'], MULTIPART_FILE_SIZE);
    });

    it('engages resumable path on access-token + large file', async () => {
      stubFs(MULTIPART_FILE_SIZE);
      const expectedChunks = Math.ceil(MULTIPART_FILE_SIZE / MULTIPART_PART_SIZE_BYTES);
      useAccessTokenUpload(MULTIPART_FILE_SIZE);

      const sessionUrl =
        'https://storage.googleapis.com/upload/storage/v1/b/mockLocation/o?upload_id=resumable-mock';
      const post = sinon.stub().resolves({ status: 200, headers: { location: sessionUrl } });
      const put = sinon.stub().callsFake(async () => {
        // Final call gets 200; preceding calls get 308 to mimic GCS's
        // "Resume Incomplete" signal.
        if (put.callCount === expectedChunks) {
          return { status: 200, headers: {} };
        }
        const committed = put.callCount * MULTIPART_PART_SIZE_BYTES - 1;
        return { status: 308, headers: { range: `bytes=0-${committed}` } };
      });
      const del = sinon.stub().resolves({ status: 204 });
      const GCS = mockGCS({ post, put, delete: del });

      await GCS.uploadFile(dataFile, meta, encryptionMetadata);

      assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
      assert.strictEqual(post.callCount, 1);
      assert.strictEqual(put.callCount, expectedChunks);
      assert.strictEqual(del.callCount, 0);

      // Verify Content-Range headers on the chunk PUTs.
      const ranges = put.getCalls().map((c) => c.args[2].headers['Content-Range']);
      const expectedRanges = Array.from({ length: expectedChunks }, (_, i) => {
        const start = i * MULTIPART_PART_SIZE_BYTES;
        const end = Math.min(start + MULTIPART_PART_SIZE_BYTES, MULTIPART_FILE_SIZE) - 1;
        return `bytes ${start}-${end}/${MULTIPART_FILE_SIZE}`;
      });
      assert.deepStrictEqual(ranges, expectedRanges);

      // Initiation POST carries Snowflake metadata as x-goog-meta-* headers
      // and announces XML API resumable mode via x-goog-resumable: start.
      const [, , initOpts] = post.firstCall.args;
      assert.strictEqual(initOpts.headers['x-goog-resumable'], 'start');
      assert.strictEqual(initOpts.headers['x-upload-content-length'], MULTIPART_FILE_SIZE);
      assert.strictEqual(initOpts.headers['x-goog-meta-sfc-digest'], meta['SHA256_DIGEST']);
      assert.ok(initOpts.headers['x-goog-meta-encryptiondata']);
      assert.strictEqual(initOpts.headers['x-goog-meta-matdesc'], mockMatDesc);
    });

    it('issues DELETE on chunk failure', async () => {
      stubFs(MULTIPART_FILE_SIZE);
      useAccessTokenUpload(MULTIPART_FILE_SIZE);

      const post = sinon.stub().resolves({
        status: 200,
        headers: { location: 'https://storage.googleapis.com/upload-session' },
      });
      const put = sinon.stub().callsFake(async () => {
        const err = new Error('boom');
        err['code'] = 500;
        err['response'] = { status: 500 };
        throw err;
      });
      const del = sinon.stub().resolves({ status: 204 });
      const GCS = mockGCS({ post, put, delete: del });

      await GCS.uploadFile(dataFile, meta, encryptionMetadata);

      assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
      assert.strictEqual(del.callCount, 1);
    });

    it('upload - resumable initiate failure surfaces NEED_RETRY without DELETE', async function () {
      stubFs(MULTIPART_FILE_SIZE);
      useAccessTokenUpload(MULTIPART_FILE_SIZE);

      const post = sinon.stub().callsFake(async () => {
        const err = new Error('init boom');
        err['code'] = 503;
        err['response'] = { status: 503 };
        throw err;
      });
      const del = sinon.stub().resolves({ status: 204 });
      const GCS = mockGCS({ post, delete: del });

      await GCS.uploadFile(dataFile, meta, encryptionMetadata);

      assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
      assert.strictEqual(del.callCount, 0);
    });
  });

  it('upload - fail need retry', async function () {
    stubFs();
    const GCS = mockGCS({
      put: async () => {
        const err = new Error();
        err.code = 403;
        throw err;
      },
    });

    await GCS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
  });

  it('upload - fail renew presigned url', async function () {
    stubFs();
    const GCS = mockGCS({
      put: async () => {
        const err = new Error();
        err.code = 400;
        throw err;
      },
    });
    meta.client = '';
    meta.lastError = { code: 0 };

    await GCS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_PRESIGNED_URL);
  });

  it('upload with token uses REST path via httpClient.put', async function () {
    stubFs();
    const put = sinon.stub().resolves();
    const GCS = mockGCS({ put });

    meta.presignedUrl = '';
    meta.client = { gcsToken: mockAccessToken };
    meta.dstFileName = 'testfile.csv';
    meta.SHA256_DIGEST = 'mockDigest';

    await GCS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
    assert.strictEqual(put.callCount, 1);
    const callArgs = put.firstCall.args;
    assert.ok(callArgs[2].headers['Authorization'].startsWith('Bearer '));
  });

  it('download with token uses REST path via httpClient.get', async function () {
    stubFs();
    const mockStream = new Readable({
      read() {
        this.push(null);
      },
    });
    const get = sinon.stub().resolves({
      status: 200,
      headers: {
        'x-goog-meta-sfc-digest': 'mockDigest',
        'content-length': '0',
      },
      data: mockStream,
    });
    sinon.stub(fs, 'createWriteStream').returns(
      new (require('stream').Writable)({
        write(_chunk, _encoding, cb) {
          cb();
        },
        final(cb) {
          cb();
        },
      }),
    );
    const GCS = mockGCS({ get });

    meta.presignedUrl = '';
    meta.client = { gcsToken: mockAccessToken };
    meta.srcFileName = 'testfile.csv';

    await GCS.nativeDownloadFile(meta, '/tmp/testfile.csv');
    assert.strictEqual(meta['resultStatus'], resultStatus.DOWNLOADED);
    assert.strictEqual(get.callCount, 1);
    const callArgs = get.firstCall.args;
    assert.ok(callArgs[1].headers['Authorization'].startsWith('Bearer '));
  });

  it('getFileHeader with token uses REST path via httpClient.head', async function () {
    const head = sinon.stub().resolves({
      headers: {
        'x-goog-meta-sfc-digest': 'mockDigest',
        'content-length': '100',
      },
    });
    const GCS = mockGCS({ head });

    meta.presignedUrl = '';
    meta.client = { gcsToken: mockAccessToken };

    const header = await GCS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
    assert.strictEqual(head.callCount, 1);
    const callArgs = head.firstCall.args;
    assert.ok(callArgs[1].headers['Authorization'].startsWith('Bearer '));
    assert.strictEqual(header.digest, 'mockDigest');
    assert.strictEqual(header.contentLength, '100');
  });

  it('upload - fail expired token', async function () {
    stubFs();
    const GCS = mockGCS({
      put: async () => {
        const err = new Error();
        err.code = 401;
        throw err;
      },
    });

    meta.presignedUrl = '';
    meta.client = { gcsToken: mockAccessToken };

    await GCS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });
});
