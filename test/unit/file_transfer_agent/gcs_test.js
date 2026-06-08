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
    getUploadPartSizeMb: function () {
      return 8;
    },
    getUploadPartSizeBytes: function () {
      return 8 * 1024 * 1024;
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
    // The Buffer-bodied upload path uses `fs.promises` instead of the legacy
    // sync/stream APIs; stub both so existing tests and new ones can coexist.
    sinonSandbox.stub(fs.promises, 'stat').resolves({ size: 4 });
    sinonSandbox.stub(fs.promises, 'readFile').resolves(Buffer.from('mock'));
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

  it('upload sends Buffer body to axios.put (not a Readable)', async function () {
    // The Buffer-bodied upload path is what sidesteps the bun
    // `body.pipe(httpRequest)` regression: the body axios.put sees must be a
    // `Buffer`, with `Content-Length` derived from its byte length. Verify
    // both: the second positional argument is a Buffer and the headers carry
    // the matching content-length.
    const putSpy = sinon.spy(async () => {});
    httpClient.put = putSpy;
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpClient);

    await GCS.uploadFile(dataFile, meta, encryptionMetadata);

    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
    assert.ok(putSpy.calledOnce, 'axios.put should be called once');
    const [, body, options] = putSpy.firstCall.args;
    assert.ok(Buffer.isBuffer(body), 'axios.put body must be a Buffer, not a Readable');
    assert.strictEqual(options.headers['Content-Length'], body.length);
  });

  it('upload of file larger than uploadPartSizeMb on legacy presigned-URL path still ships via single Buffer PUT', async function () {
    // Workspace stage presigned URLs are signed for one specific PUT and
    // cannot initiate a resumable upload. So when GS hands back a
    // `presignedUrl` (the legacy path; pre-CB_2023_06 deployments or driver
    // versions before 1.6.21), large files fall back to a single Buffer PUT
    // even though the access-token path would split into chunks. Verify
    // both: result is UPLOADED and the body Buffer matches the file size.
    fs.promises.stat.restore();
    fs.promises.readFile.restore();
    const largeSize = (connectionConfig.getUploadPartSizeMb() + 4) * 1024 * 1024; // 12 MiB
    sinonSandbox.stub(fs.promises, 'stat').resolves({ size: largeSize });
    sinonSandbox.stub(fs.promises, 'readFile').resolves(Buffer.alloc(largeSize, 0));
    const putSpy = sinon.spy(async () => {});
    httpClient.put = putSpy;
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpClient);

    await GCS.uploadFile(dataFile, meta, encryptionMetadata);

    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
    assert.ok(putSpy.calledOnce);
    const [, body, options] = putSpy.firstCall.args;
    assert.ok(Buffer.isBuffer(body));
    assert.strictEqual(body.length, largeSize);
    assert.strictEqual(options.headers['Content-Length'], largeSize);
  });

  it('upload - resumable path engaged on access-token + large file', async function () {
    // The access-token path (gcsToken populated, no presignedUrl) with a
    // file larger than uploadPartSizeMb takes the resumable upload session:
    // one POST to initiate, N×PUT to deliver chunks, no single-PUT.
    fs.promises.stat.restore();
    fs.promises.readFile.restore();
    const partSizeMb = connectionConfig.getUploadPartSizeMb();
    const partSize = partSizeMb * 1024 * 1024;
    // 17 MiB; chunked into [8 MiB, 8 MiB, 1 MiB] per the 256-KiB-aligned
    // partition rule. Final chunk is unaligned; preceding two are 8 MiB.
    const fileSize = partSize * 2 + 1024 * 1024;
    sinonSandbox.stub(fs.promises, 'stat').resolves({ size: fileSize });
    sinonSandbox.stub(fs.promises, 'open').callsFake(async () => {
      let position = 0;
      return {
        read: async (buf, offset, length /* , filePos */) => {
          const remaining = Math.max(0, fileSize - position);
          const toRead = Math.min(length, remaining);
          buf.fill(0, offset, offset + toRead);
          position += toRead;
          return { bytesRead: toRead };
        },
        close: async () => {},
      };
    });
    meta.presignedUrl = '';
    meta.client = { gcsToken: mockAccessToken };
    meta.uploadSize = fileSize;

    const sessionUrl =
      'https://storage.googleapis.com/upload/storage/v1/b/mockLocation/o?upload_id=resumable-mock';
    const postSpy = sinon.spy(async () => ({
      status: 200,
      headers: { location: sessionUrl },
    }));
    let putCalls = 0;
    const putSpy = sinon.spy(async () => {
      putCalls += 1;
      // Final call gets 200; preceding calls get 308 to mimic GCS's
      // "Resume Incomplete" signal.
      if (putCalls === 3) {
        return { status: 200, headers: {} };
      }
      // Compute the highest committed byte from the chunks issued so far,
      // matching the wire shape GCS would send back.
      const committed = putCalls * partSize - 1;
      return { status: 308, headers: { range: `bytes=0-${committed}` } };
    });
    httpClient.post = postSpy;
    httpClient.put = putSpy;
    httpClient.delete = sinon.spy(async () => ({ status: 204 }));
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpClient);

    await GCS.uploadFile(dataFile, meta, encryptionMetadata);

    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
    assert.strictEqual(postSpy.callCount, 1, 'one initiation POST');
    assert.strictEqual(putSpy.callCount, 3, 'three chunk PUTs (8 MiB + 8 MiB + 1 MiB)');
    assert.strictEqual(httpClient.delete.callCount, 0, 'no DELETE on success');

    // Verify Content-Range headers on the chunk PUTs.
    const ranges = putSpy.getCalls().map((c) => c.args[2].headers['Content-Range']);
    assert.deepStrictEqual(ranges, [
      `bytes 0-${partSize - 1}/${fileSize}`,
      `bytes ${partSize}-${partSize * 2 - 1}/${fileSize}`,
      `bytes ${partSize * 2}-${fileSize - 1}/${fileSize}`,
    ]);

    // Initiation POST carries Snowflake metadata as x-goog-meta-* headers
    // and announces XML API resumable mode via x-goog-resumable: start.
    const [, , initOpts] = postSpy.firstCall.args;
    assert.strictEqual(initOpts.headers['x-goog-resumable'], 'start');
    assert.strictEqual(initOpts.headers['x-upload-content-length'], fileSize);
    assert.strictEqual(initOpts.headers['x-goog-meta-sfc-digest'], meta['SHA256_DIGEST']);
    assert.ok(initOpts.headers['x-goog-meta-encryptiondata']);
    assert.strictEqual(initOpts.headers['x-goog-meta-matdesc'], mockMatDesc);
  });

  it('upload - resumable path issues DELETE on chunk failure', async function () {
    // A non-recoverable chunk failure (e.g., 4xx) must abort the session
    // via DELETE so the upload doesn't linger as a half-staged blob.
    fs.promises.stat.restore();
    fs.promises.readFile.restore();
    const partSize = connectionConfig.getUploadPartSizeMb() * 1024 * 1024;
    const fileSize = partSize * 2 + 1024;
    sinonSandbox.stub(fs.promises, 'stat').resolves({ size: fileSize });
    sinonSandbox.stub(fs.promises, 'open').callsFake(async () => {
      let position = 0;
      return {
        read: async (buf, offset, length /* , filePos */) => {
          const remaining = Math.max(0, fileSize - position);
          const toRead = Math.min(length, remaining);
          buf.fill(0, offset, offset + toRead);
          position += toRead;
          return { bytesRead: toRead };
        },
        close: async () => {},
      };
    });
    meta.presignedUrl = '';
    meta.client = { gcsToken: mockAccessToken };
    meta.uploadSize = fileSize;

    httpClient.post = async () => ({
      status: 200,
      headers: { location: 'https://storage.googleapis.com/upload-session' },
    });
    httpClient.put = async () => {
      const err = new Error('boom');
      err['code'] = 500;
      err['response'] = { status: 500 };
      throw err;
    };
    const deleteSpy = sinon.spy(async () => ({ status: 204 }));
    httpClient.delete = deleteSpy;
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpClient);

    await GCS.uploadFile(dataFile, meta, encryptionMetadata);

    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
    assert.strictEqual(deleteSpy.callCount, 1, 'DELETE must fire on terminal failure');
  });

  it('upload - resumable initiate failure surfaces NEED_RETRY without DELETE', async function () {
    // If the initiation POST itself fails, there is no session to abort —
    // DELETE must NOT fire. meta should still reflect a retryable error
    // so the caller's outer retry loop takes over.
    fs.promises.stat.restore();
    fs.promises.readFile.restore();
    const partSize = connectionConfig.getUploadPartSizeMb() * 1024 * 1024;
    const fileSize = partSize * 2;
    sinonSandbox.stub(fs.promises, 'stat').resolves({ size: fileSize });
    meta.presignedUrl = '';
    meta.client = { gcsToken: mockAccessToken };
    meta.uploadSize = fileSize;

    httpClient.post = async () => {
      const err = new Error('init boom');
      err['code'] = 503;
      err['response'] = { status: 503 };
      throw err;
    };
    const deleteSpy = sinon.spy(async () => ({ status: 204 }));
    httpClient.delete = deleteSpy;
    const GCS = new SnowflakeGCSUtil(connectionConfig, httpClient);

    await GCS.uploadFile(dataFile, meta, encryptionMetadata);

    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
    assert.strictEqual(deleteSpy.callCount, 0, 'no DELETE when there is no session');
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
