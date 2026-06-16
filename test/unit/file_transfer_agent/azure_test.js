const assert = require('assert');
const AZURE = require('@azure/storage-blob');
const fs = require('fs');
const { Readable } = require('stream');
const snowflake = require('./../../../lib/snowflake').default;
const sinon = require('sinon');
const SnowflakeAzureUtil = require('./../../../lib/file_transfer_agent/azure_util');
const resultStatus = require('../../../lib/file_util').resultStatus;
const {
  MULTIPART_THRESHOLD_BYTES,
  MULTIPART_PART_SIZE_BYTES,
} = require('../../../lib/file_transfer_agent/multipart');

describe('Azure client', function () {
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
    accessUrl: 'http://fakeaccount.snowflakecomputing.com',
  };

  let Azure = null;
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

  let sinonSandbox;
  const getPropertiesStub = sinon.stub();
  const uploadStub = sinon.stub();
  const stageBlockStub = sinon.stub();
  const commitBlockListStub = sinon.stub();
  const deleteIfExistsStub = sinon.stub();

  function verifyNameAndPath(bucketPath, containerName, path) {
    const result = Azure.extractContainerNameAndPath(bucketPath);
    assert.strictEqual(result.containerName, containerName);
    assert.strictEqual(result.path, path);
  }

  // Configure the `fs.promises` shape that `uploadFile` needs to dispatch
  // between the single-block (small-file) and multi-block (multipart) paths.
  // The single-block path needs `stat` (for the size check) and `readFile`
  // (to slurp the Buffer); the multi-block path needs `stat` and `open`
  // (for chunked reads). `fileSize` controls which branch the test exercises.
  function stubFsForUpload(fileSize) {
    const mockBytes = Buffer.alloc(fileSize, 0);
    sinonSandbox.stub(fs.promises, 'stat').resolves({ size: fileSize });
    sinonSandbox.stub(fs.promises, 'readFile').resolves(mockBytes);
    sinonSandbox.stub(fs.promises, 'open').callsFake(async function () {
      let position = 0;
      return {
        read: async function (buf, offset, length /* , filePos */) {
          const remaining = Math.max(0, fileSize - position);
          const toRead = Math.min(length, remaining);
          buf.fill(0, offset, offset + toRead);
          position += toRead;
          return { bytesRead: toRead };
        },
        close: async function () {},
      };
    });
  }

  before(function () {
    sinonSandbox = sinon.createSandbox();
    sinonSandbox.stub(AZURE, 'BlobServiceClient').returns({
      getContainerClient: () => ({
        getBlobClient: () => ({
          getProperties: getPropertiesStub,
        }),
        getBlockBlobClient: () => ({
          upload: uploadStub,
          uploadStream: uploadStub,
          stageBlock: stageBlockStub,
          commitBlockList: commitBlockListStub,
          deleteIfExists: deleteIfExistsStub,
        }),
      }),
    });
    sinonSandbox.stub(fs, 'createReadStream').callsFake(() => Readable.from([Buffer.from('mock')]));
    Azure = new SnowflakeAzureUtil(noProxyConnectionConfig);
  });

  afterEach(() => {
    getPropertiesStub.reset();
    uploadStub.reset();
    stageBlockStub.reset();
    commitBlockListStub.reset();
    deleteIfExistsStub.reset();
    // `stubFsForUpload` adds per-test stubs on `fs.promises`; restore them so
    // each test starts from a clean slate. The class-level `BlobServiceClient`
    // and `createReadStream` stubs persist via the outer `after()` hook.
    if (fs.promises.stat.restore) fs.promises.stat.restore();
    if (fs.promises.readFile.restore) fs.promises.readFile.restore();
    if (fs.promises.open.restore) fs.promises.open.restore();
  });

  after(() => {
    sinonSandbox.restore();
  });

  it('extract bucket name and path', async function () {
    verifyNameAndPath('sfc-eng-regression/test_sub_dir/', 'sfc-eng-regression', 'test_sub_dir/');
    verifyNameAndPath(
      'sfc-eng-regression/stakeda/test_stg/test_sub_dir/',
      'sfc-eng-regression',
      'stakeda/test_stg/test_sub_dir/',
    );
    verifyNameAndPath('sfc-eng-regression/', 'sfc-eng-regression', '');
    verifyNameAndPath('sfc-eng-regression//', 'sfc-eng-regression', '/');
    verifyNameAndPath('sfc-eng-regression///', 'sfc-eng-regression', '//');
  });

  it('get file header - success', async function () {
    getPropertiesStub.resolves({ metadata: {} });
    await Azure.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
  });

  it('get file header - fail expired token', async function () {
    getPropertiesStub.throws(() => {
      const err = new Error();
      err.code = 'ExpiredToken';
      throw err;
    });
    await Azure.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('get file header - fail HTTP 404', async function () {
    getPropertiesStub.throws(() => {
      const err = new Error();
      err.statusCode = 404;
      return err;
    });
    await Azure.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.NOT_FOUND_FILE);
  });

  it('get file header - fail HTTP 400', async function () {
    getPropertiesStub.throws(() => {
      const err = new Error();
      err.statusCode = 400;
      return err;
    });
    await Azure.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('get file header - fail unknown', async function () {
    getPropertiesStub.throws(() => {
      const err = new Error();
      err.code = 'unknown';
      return err;
    });
    await Azure.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.ERROR);
  });

  it('upload - small file uses single block path', async function () {
    // 4 bytes is comfortably below the 8 MiB threshold, so dispatch lands on
    // `blockBlobClient.upload` rather than the stageBlock+commitBlockList pair.
    stubFsForUpload(4);
    uploadStub.resolves();
    await Azure.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
    assert.strictEqual(uploadStub.callCount, 1, 'small-file path should call upload() once');
    assert.strictEqual(stageBlockStub.callCount, 0, 'small-file path should NOT stage blocks');
    assert.strictEqual(
      commitBlockListStub.callCount,
      0,
      'small-file path should NOT commit a block list',
    );
  });

  it('upload - fail expired token', async function () {
    stubFsForUpload(4);
    uploadStub.throws(() => {
      const err = new Error('Server failed to authenticate the request.');
      err.statusCode = 403;
      throw err;
    });
    await Azure.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('upload - fail HTTP 400', async function () {
    stubFsForUpload(4);
    uploadStub.throws(() => {
      const err = new Error();
      err.statusCode = 400;
      throw err;
    });
    await Azure.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
  });

  describe('Multipart upload', () => {
    before(() => {
      snowflake.configure({ enableExperimentalMultipartUploads: true });
    });

    after(() => {
      snowflake.configure({ enableExperimentalMultipartUploads: false });
    });

    it('engages multipart path when file exceeds the multipart threshold', async () => {
      // Force the multi-block codepath by faking a file larger than
      // MULTIPART_THRESHOLD_BYTES, split into MULTIPART_PART_SIZE_BYTES chunks
      // plus a remainder.
      const fileSize = MULTIPART_THRESHOLD_BYTES + MULTIPART_PART_SIZE_BYTES + 1024 * 1024;
      const expectedBlocks = Math.ceil(fileSize / MULTIPART_PART_SIZE_BYTES);
      stubFsForUpload(fileSize);
      stageBlockStub.resolves();
      commitBlockListStub.resolves();

      await Azure.uploadFile(dataFile, meta, encryptionMetadata);

      assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
      assert.strictEqual(uploadStub.callCount, 0, 'multipart path should NOT call upload()');
      assert.strictEqual(
        stageBlockStub.callCount,
        expectedBlocks,
        'expected one stageBlock call per chunk',
      );
      assert.strictEqual(commitBlockListStub.callCount, 1, 'commitBlockList should fire once');
      assert.strictEqual(
        deleteIfExistsStub.callCount,
        0,
        'deleteIfExists should NOT fire on success',
      );

      // Verify the block list passed to commitBlockList: ascending fixed-width
      // base64 IDs. Decoded form is `NNNNNNNNNN`.
      const passedBlockIds = commitBlockListStub.firstCall.args[0];
      assert.strictEqual(passedBlockIds.length, expectedBlocks);
      const decoded = passedBlockIds.map((id) => Buffer.from(id, 'base64').toString());
      const expectedDecoded = Array.from({ length: expectedBlocks }, (_, i) =>
        String(i + 1).padStart(10, '0'),
      );
      assert.deepStrictEqual(decoded, expectedDecoded);

      // Verify metadata + headers travel on commit, not on stageBlock.
      const commitOpts = commitBlockListStub.firstCall.args[1];
      assert.strictEqual(commitOpts.metadata.sfcdigest, mockDigest);
      assert.ok(commitOpts.metadata.encryptiondata, 'encryption envelope present');
      assert.strictEqual(commitOpts.blobHTTPHeaders.blobContentType, 'application/octet-stream');
    });

    it('cleans up on stageBlock failure', async () => {
      // Stage the first chunk successfully, then throw on the second.
      // The driver should issue deleteIfExists() to release the staged block
      // and surface NEED_RETRY so the caller's retry loop can take over.
      const fileSize = MULTIPART_THRESHOLD_BYTES + MULTIPART_PART_SIZE_BYTES + 1024;
      stubFsForUpload(fileSize);
      stageBlockStub.onFirstCall().resolves();
      stageBlockStub.onSecondCall().throws(() => {
        const err = new Error('boom');
        err.statusCode = 500;
        throw err;
      });
      deleteIfExistsStub.resolves();

      await Azure.uploadFile(dataFile, meta, encryptionMetadata);

      assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
      assert.strictEqual(stageBlockStub.callCount, 2, 'expected 2 stageBlock calls before failure');
      assert.strictEqual(
        commitBlockListStub.callCount,
        0,
        'commit must NOT fire after stage failure',
      );
      assert.strictEqual(deleteIfExistsStub.callCount, 1, 'cleanup deleteIfExists must fire');
    });

    it('suppresses cleanup error', async () => {
      // The cleanup error must not mask the original cause; meta retains
      // NEED_RETRY from the stageBlock failure.
      const fileSize = MULTIPART_THRESHOLD_BYTES + MULTIPART_PART_SIZE_BYTES;
      stubFsForUpload(fileSize);
      stageBlockStub.onFirstCall().resolves();
      stageBlockStub.onSecondCall().throws(() => {
        const err = new Error('staged block 2 boom');
        err.statusCode = 500;
        throw err;
      });
      deleteIfExistsStub.throws(() => new Error('cleanup boom'));

      await Azure.uploadFile(dataFile, meta, encryptionMetadata);

      assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
      assert.strictEqual(meta['lastError'].message, 'staged block 2 boom');
    });
  });
});
