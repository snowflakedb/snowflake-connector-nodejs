const assert = require('assert');
const mock = require('mock-require');
const { Readable } = require('stream');
const SnowflakeS3Util = require('./../../../lib/file_transfer_agent/s3_util').S3Util;
const extractBucketNameAndPath =
  require('./../../../lib/file_transfer_agent/s3_util').extractBucketNameAndPath;

const resultStatus = require('../../../lib/file_util').resultStatus;

// Reusable S3 method behaviours.
const resolveEmptyMetadata = () => Promise.resolve({ Metadata: '' });
const resolveDownload = () =>
  Promise.resolve({
    $metadata: { httpStatusCode: 200 },
    Body: {
      transformToByteArray: () => Promise.resolve(Buffer.from('mock')),
    },
  });
const throwWithCode = (code) => () => {
  const err = new Error();
  err.Code = code;
  throw err;
};

// Registers a mock `s3` module and returns the freshly-required handle.
// Only the fields explicitly passed are attached to the constructed S3 instance,
// so each test can opt into exactly the surface it exercises.
function mockS3({
  getObject,
  putObject,
  createMultipartUpload,
  uploadPart,
  completeMultipartUpload,
  abortMultipartUpload,
  captureConfig = false,
  onDestroy,
} = {}) {
  mock('s3', {
    S3: function (config) {
      function S3() {
        if (captureConfig) {
          this.config = config;
        }
        if (getObject) {
          this.getObject = getObject;
        }
        if (putObject) {
          this.putObject = putObject;
        }
        if (createMultipartUpload) {
          this.createMultipartUpload = createMultipartUpload;
        }
        if (uploadPart) {
          this.uploadPart = uploadPart;
        }
        if (completeMultipartUpload) {
          this.completeMultipartUpload = completeMultipartUpload;
        }
        if (abortMultipartUpload) {
          this.abortMultipartUpload = abortMultipartUpload;
        }
      }
      S3.prototype.destroy = onDestroy || function () {};
      return new S3();
    },
  });
  return require('s3');
}

// Registers a mock `filesystem` module with sensible defaults; tests can override `writeFile`.
function mockFilesystem({ writeFile, fileSize = 4 } = {}) {
  // The Buffer-and-multipart upload path stat()s the file before reading it,
  // so the mock has to expose enough of `fs.promises` for that codepath.
  const mockBytes = Buffer.from('mock');
  const impl = {
    createReadStream: function () {
      return Readable.from([mockBytes]);
    },
    readFileSync: async function (data) {
      return data;
    },
    promises: {
      stat: async function () {
        return { size: fileSize };
      },
      readFile: async function () {
        return mockBytes;
      },
      open: async function () {
        // Pretend each `read()` returns exactly the requested length, drawing
        // from `fileSize` total — the test cares about chunking, not bytes.
        let position = 0;
        return {
          read: async function (buf, offset, length /* , filePos */) {
            const remaining = Math.max(0, fileSize - position);
            const toRead = Math.min(length, remaining);
            // Fill buffer with deterministic bytes so the consumer doesn't
            // see uninitialized memory.
            buf.fill(0, offset, offset + toRead);
            position += toRead;
            return { bytesRead: toRead };
          },
          close: async function () {},
        };
      },
    },
  };
  if (writeFile) {
    impl.writeFile = writeFile;
  }
  mock('filesystem', impl);
  return require('filesystem');
}

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
    },
    getUploadPartSizeMb: function () {
      return 8;
    },
    getUploadPartSizeBytes: function () {
      return 8 * 1024 * 1024;
    },
  };

  let AWS;
  let s3;
  let filesystem;
  const dataFile = mockDataFile;
  const meta = {
    stageInfo: {
      location: mockLocation,
      path: mockTable + '/' + mockPath + '/',
      creds: {},
    },
    SHA256_DIGEST: mockDigest,
  };
  const encryptionMetadata = {
    key: mockKey,
    iv: mockIv,
    matDesc: mockMatDesc,
  };

  before(function () {
    s3 = mockS3({
      getObject: resolveEmptyMetadata,
      putObject: () => Promise.resolve(),
      captureConfig: true,
    });
    filesystem = mockFilesystem();
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
        result: null,
      },
      {
        name: 'when useS3RegionalURL and is enabled and domain starts with cn',
        stageInfo: {
          ...originalStageInfo,
          useS3RegionalUrl: true,
          endPoint: null,
          region: 'cn-mockLocation',
        },
        result: 'https://s3.cn-mockLocation.amazonaws.com.cn',
      },
      {
        name: 'when endPoint is enabled',
        stageInfo: {
          ...originalStageInfo,
          endPoint: 's3.endpoint',
          useS3RegionalUrl: false,
        },
        result: 'https://s3.endpoint',
      },
      {
        name: 'when both endPoint and useS3PReiongalUrl is valid',
        stageInfo: {
          ...originalStageInfo,
          endPoint: 's3.endpoint',
          useS3RegionalUrl: true,
        },
        result: 'https://s3.endpoint',
      },
    ];

    testCases.forEach(({ name, stageInfo, result }) => {
      it(name, () => {
        const client = AWS.createClient(stageInfo);
        assert.strictEqual(client.config.endpoint, result);
      });
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
    s3 = mockS3({ getObject: throwWithCode('ExpiredToken') });
    const AWS = new SnowflakeS3Util(noProxyConnectionConfig, s3);
    await AWS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('get file header - fail no such key', async function () {
    s3 = mockS3({ getObject: throwWithCode('NoSuchKey') });
    const AWS = new SnowflakeS3Util(noProxyConnectionConfig, s3);
    await AWS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.NOT_FOUND_FILE);
  });

  it('get file header - fail HTTP 400', async function () {
    s3 = mockS3({ getObject: throwWithCode('400') });
    const AWS = new SnowflakeS3Util(noProxyConnectionConfig, s3, filesystem);
    await AWS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('get file header - fail unknown', async function () {
    s3 = mockS3({ getObject: throwWithCode('unknown') });
    const AWS = new SnowflakeS3Util(noProxyConnectionConfig, s3, filesystem);
    await AWS.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.ERROR);
  });

  it('upload - success', async function () {
    await AWS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
  });

  it('upload - multipart path engaged when file exceeds uploadPartSizeMb', async function () {
    // Force the multipart codepath by faking a file that's larger than the
    // smallest legal uploadPartSizeMb (5 MiB) and exposing the lifecycle calls
    // that path uses end-to-end.
    const partSizeMb = 5;
    const partSize = partSizeMb * 1024 * 1024;
    const fileSize = partSize * 2 + 1024; // 3 parts: full, full, remainder
    const multipartFs = mockFilesystem({ fileSize });
    let createdMultipart = 0;
    let uploadedParts = 0;
    let completed = 0;
    let aborted = 0;
    const multipartS3 = mockS3({
      createMultipartUpload: async () => {
        createdMultipart += 1;
        return { UploadId: 'mock-upload-id' };
      },
      uploadPart: async () => {
        uploadedParts += 1;
        return { ETag: `etag-${uploadedParts}` };
      },
      completeMultipartUpload: async () => {
        completed += 1;
      },
      abortMultipartUpload: async () => {
        aborted += 1;
      },
    });
    const multipartConfig = {
      getProxy: () => null,
      getUploadPartSizeMb: () => partSizeMb,
      getUploadPartSizeBytes: () => partSizeMb * 1024 * 1024,
    };
    const multipartUtil = new SnowflakeS3Util(multipartConfig, multipartS3, multipartFs);
    const localMeta = JSON.parse(JSON.stringify(meta));
    localMeta['client'] = multipartUtil.createClient(localMeta['stageInfo']);
    await multipartUtil.uploadFile(dataFile, localMeta, encryptionMetadata);
    assert.strictEqual(localMeta['resultStatus'], resultStatus.UPLOADED);
    assert.strictEqual(createdMultipart, 1, 'createMultipartUpload should fire once');
    assert.strictEqual(uploadedParts, 3, 'expected 3 UploadPart calls for 3 chunks');
    assert.strictEqual(completed, 1, 'completeMultipartUpload should fire once');
    assert.strictEqual(aborted, 0, 'abortMultipartUpload should not fire on success');
  });

  it('upload - multipart aborts and renews token on UploadPart ExpiredToken', async function () {
    // Token-expiry mid-multipart should: (a) propagate to meta as RENEW_TOKEN
    // so the outer retry loop re-mints credentials; (b) abort the multipart
    // session so we don't leak parts in S3. The first uploadPart succeeds;
    // the second throws ExpiredToken.
    const partSizeMb = 5;
    const partSize = partSizeMb * 1024 * 1024;
    const fileSize = partSize * 2 + 1024;
    const multipartFs = mockFilesystem({ fileSize });
    let parts = 0;
    let aborted = 0;
    let completed = 0;
    const multipartS3 = mockS3({
      createMultipartUpload: async () => ({ UploadId: 'mock-upload-id' }),
      uploadPart: async () => {
        parts += 1;
        if (parts === 2) {
          const err = new Error('expired token');
          err.Code = 'ExpiredToken';
          throw err;
        }
        return { ETag: `etag-${parts}` };
      },
      completeMultipartUpload: async () => {
        completed += 1;
      },
      abortMultipartUpload: async () => {
        aborted += 1;
      },
    });
    const multipartConfig = {
      getProxy: () => null,
      getUploadPartSizeMb: () => partSizeMb,
      getUploadPartSizeBytes: () => partSizeMb * 1024 * 1024,
    };
    const multipartUtil = new SnowflakeS3Util(multipartConfig, multipartS3, multipartFs);
    const localMeta = JSON.parse(JSON.stringify(meta));
    localMeta['client'] = multipartUtil.createClient(localMeta['stageInfo']);
    await multipartUtil.uploadFile(dataFile, localMeta, encryptionMetadata);
    assert.strictEqual(localMeta['resultStatus'], resultStatus.RENEW_TOKEN);
    assert.strictEqual(parts, 2, 'second UploadPart triggers the failure');
    assert.strictEqual(aborted, 1, 'abortMultipartUpload must fire');
    assert.strictEqual(completed, 0, 'completeMultipartUpload must NOT fire');
  });

  it('upload - multipart short-read aborts and surfaces NEED_RETRY', async function () {
    // If the file shrinks (or fd.read otherwise returns fewer bytes than
    // requested), upload bail out before submitting a partial part — sending
    // an under-sized UploadPart would later make CompleteMultipartUpload
    // disagree with the original Content-Length and corrupt the object.
    const partSizeMb = 5;
    const partSize = partSizeMb * 1024 * 1024;
    const fileSize = partSize * 2 + 1024;
    const shortReadFs = {
      createReadStream: () => Readable.from([Buffer.from('mock')]),
      readFileSync: async (data) => data,
      promises: {
        stat: async () => ({ size: fileSize }),
        readFile: async () => Buffer.from('mock'),
        open: async () => {
          let calls = 0;
          return {
            read: async (buf, offset, length /* , filePos */) => {
              calls += 1;
              if (calls === 2) {
                // Simulate a shrunk file: return fewer bytes than requested.
                buf.fill(0, offset, offset + 16);
                return { bytesRead: 16 };
              }
              buf.fill(0, offset, offset + length);
              return { bytesRead: length };
            },
            close: async () => {},
          };
        },
      },
    };
    let parts = 0;
    let aborted = 0;
    const multipartS3 = mockS3({
      createMultipartUpload: async () => ({ UploadId: 'mock-upload-id' }),
      uploadPart: async () => {
        parts += 1;
        return { ETag: `etag-${parts}` };
      },
      completeMultipartUpload: async () => {},
      abortMultipartUpload: async () => {
        aborted += 1;
      },
    });
    const multipartConfig = {
      getProxy: () => null,
      getUploadPartSizeMb: () => partSizeMb,
      getUploadPartSizeBytes: () => partSizeMb * 1024 * 1024,
    };
    const multipartUtil = new SnowflakeS3Util(multipartConfig, multipartS3, shortReadFs);
    const localMeta = JSON.parse(JSON.stringify(meta));
    localMeta['client'] = multipartUtil.createClient(localMeta['stageInfo']);
    await multipartUtil.uploadFile(dataFile, localMeta, encryptionMetadata);
    assert.strictEqual(localMeta['resultStatus'], resultStatus.NEED_RETRY);
    assert.strictEqual(parts, 1, 'only the first part succeeded before the short read');
    assert.strictEqual(aborted, 1, 'abortMultipartUpload must fire');
    assert.ok(
      String(localMeta['lastError']).includes('Short read'),
      'meta.lastError captures the short-read cause',
    );
  });

  it('getFileHeader destroys client after success', async function () {
    let destroyed = false;
    s3 = mockS3({
      getObject: resolveEmptyMetadata,
      onDestroy: () => {
        destroyed = true;
      },
    });
    const client = new SnowflakeS3Util(noProxyConnectionConfig, s3, filesystem);
    await client.getFileHeader(meta, dataFile);
    assert.strictEqual(destroyed, true);
  });

  it('getFileHeader destroys client after error', async function () {
    let destroyed = false;
    s3 = mockS3({
      getObject: throwWithCode('ExpiredToken'),
      onDestroy: () => {
        destroyed = true;
      },
    });
    const client = new SnowflakeS3Util(noProxyConnectionConfig, s3);
    await client.getFileHeader(meta, dataFile);
    assert.strictEqual(destroyed, true);
  });

  it('uploadFile destroys client after success', async function () {
    let destroyed = false;
    s3 = mockS3({
      putObject: () => Promise.resolve(),
      onDestroy: () => {
        destroyed = true;
      },
    });
    const client = new SnowflakeS3Util(noProxyConnectionConfig, s3, filesystem);
    await client.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(destroyed, true);
  });

  it('uploadFile destroys client after error', async function () {
    let destroyed = false;
    s3 = mockS3({
      putObject: throwWithCode('ExpiredToken'),
      onDestroy: () => {
        destroyed = true;
      },
    });
    const client = new SnowflakeS3Util(noProxyConnectionConfig, s3, filesystem);
    await client.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(destroyed, true);
  });

  it('nativeDownloadFile destroys client after success', async function () {
    let destroyed = false;
    s3 = mockS3({
      getObject: resolveDownload,
      onDestroy: () => {
        destroyed = true;
      },
    });
    filesystem = mockFilesystem({
      writeFile: (path, data, encoding, cb) => cb(null),
    });
    const client = new SnowflakeS3Util(noProxyConnectionConfig, s3, filesystem);
    await client.nativeDownloadFile(meta, '/tmp/mock');
    assert.strictEqual(destroyed, true);
  });

  it('nativeDownloadFile destroys client after error', async function () {
    let destroyed = false;
    s3 = mockS3({
      getObject: throwWithCode('ExpiredToken'),
      onDestroy: () => {
        destroyed = true;
      },
    });
    const client = new SnowflakeS3Util(noProxyConnectionConfig, s3);
    await client.nativeDownloadFile(meta, '/tmp/mock');
    assert.strictEqual(destroyed, true);
  });

  it('upload - fail expired token', async function () {
    s3 = mockS3({ putObject: throwWithCode('ExpiredToken') });
    filesystem = mockFilesystem();
    const AWS = new SnowflakeS3Util(noProxyConnectionConfig, s3, filesystem);
    await AWS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('upload - fail wsaeconnaborted', async function () {
    s3 = mockS3({ putObject: throwWithCode('10053') });
    filesystem = mockFilesystem();
    const AWS = new SnowflakeS3Util(noProxyConnectionConfig, s3, filesystem);
    await AWS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY_WITH_LOWER_CONCURRENCY);
  });

  it('upload - fail HTTP 400', async function () {
    s3 = mockS3({ putObject: throwWithCode('400') });
    filesystem = mockFilesystem();
    const AWS = new SnowflakeS3Util(noProxyConnectionConfig, s3, filesystem);
    await AWS.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
  });

  it('proxy configured', async function () {
    s3 = mockS3({
      putObject: () => {},
      captureConfig: true,
    });
    const proxyOptions = {
      host: '127.0.0.1',
      port: 8080,
      user: 'user',
      password: 'password',
      protocol: 'https',
    };
    const proxyConnectionConfig = {
      accessUrl: 'http://snowflake.com',
      getProxy: function () {
        return proxyOptions;
      },
      getUploadPartSizeMb: function () {
        return 8;
      },
      getUploadPartSizeBytes: function () {
        return 8 * 1024 * 1024;
      },
      crlValidatorConfig: {
        checkMode: 'DISABLED',
      },
    };
    const AWS = new SnowflakeS3Util(proxyConnectionConfig, s3);
    meta['client'] = AWS.createClient(meta['stageInfo']);

    const clientConfig = await meta['client'].config.requestHandler.configProvider;
    const clientHttpAgent = await clientConfig.httpAgentProvider();
    assert.equal(clientHttpAgent.options.host, proxyOptions.host);
    assert.equal(clientHttpAgent.options.hostname, 'snowflake.com');
    assert.equal(clientHttpAgent.options.user, proxyOptions.user);
    assert.equal(clientHttpAgent.options.password, proxyOptions.password);
    assert.equal(clientHttpAgent.options.port, proxyOptions.port);

    assert.equal(clientConfig.httpsAgent.options.host, proxyOptions.host);
    assert.equal(clientConfig.httpsAgent.options.hostname, 'snowflake.com');
    assert.equal(clientConfig.httpsAgent.options.user, proxyOptions.user);
    assert.equal(clientConfig.httpsAgent.options.password, proxyOptions.password);
    assert.equal(clientConfig.httpsAgent.options.port, proxyOptions.port);
  });
});
