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
const { fakeFileHandle } = require('./multipart_test_utils');

function azureError({ code, statusCode, message } = {}) {
  const err = new Error(message);
  if (code) {
    err.code = code;
  }
  if (statusCode) {
    err.statusCode = statusCode;
  }
  return err;
}

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

  afterEach(() => {
    sinon.restore();
  });

  function mockBlobClient(methods = {}) {
    sinon.stub(AZURE, 'BlobServiceClient').returns({
      getContainerClient: () => ({
        getBlobClient: () => ({ getProperties: methods.getProperties }),
        getBlockBlobClient: () => ({
          upload: methods.upload,
          uploadStream: methods.uploadStream ?? methods.upload,
          stageBlock: methods.stageBlock,
          commitBlockList: methods.commitBlockList,
          deleteIfExists: methods.deleteIfExists,
        }),
      }),
    });
    return new SnowflakeAzureUtil(noProxyConnectionConfig);
  }

  function stubFs(fileSize) {
    sinon.stub(fs, 'createReadStream').callsFake(() => Readable.from([Buffer.from('mock')]));
    sinon.stub(fs.promises, 'stat').resolves({ size: fileSize });
    sinon.stub(fs.promises, 'readFile').resolves(Buffer.alloc(fileSize, 0));
    sinon.stub(fs.promises, 'open').callsFake(async () => fakeFileHandle(fileSize));
  }

  function verifyNameAndPath(snowflakeAzureUtil, bucketPath, containerName, path) {
    const result = snowflakeAzureUtil.extractContainerNameAndPath(bucketPath);
    assert.strictEqual(result.containerName, containerName);
    assert.strictEqual(result.path, path);
  }

  it('extract bucket name and path', async function () {
    const Azure = mockBlobClient();
    verifyNameAndPath(
      Azure,
      'sfc-eng-regression/test_sub_dir/',
      'sfc-eng-regression',
      'test_sub_dir/',
    );
    verifyNameAndPath(
      Azure,
      'sfc-eng-regression/stakeda/test_stg/test_sub_dir/',
      'sfc-eng-regression',
      'stakeda/test_stg/test_sub_dir/',
    );
    verifyNameAndPath(Azure, 'sfc-eng-regression/', 'sfc-eng-regression', '');
    verifyNameAndPath(Azure, 'sfc-eng-regression//', 'sfc-eng-regression', '/');
    verifyNameAndPath(Azure, 'sfc-eng-regression///', 'sfc-eng-regression', '//');
  });

  it('get file header - success', async function () {
    const Azure = mockBlobClient({ getProperties: sinon.stub().resolves({ metadata: {} }) });
    await Azure.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
  });

  it('get file header - fail expired token', async function () {
    const Azure = mockBlobClient({
      getProperties: sinon.stub().throws(azureError({ code: 'ExpiredToken' })),
    });
    await Azure.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('get file header - fail HTTP 404', async function () {
    const Azure = mockBlobClient({
      getProperties: sinon.stub().throws(azureError({ statusCode: 404 })),
    });
    await Azure.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.NOT_FOUND_FILE);
  });

  it('get file header - fail HTTP 400', async function () {
    const Azure = mockBlobClient({
      getProperties: sinon.stub().throws(azureError({ statusCode: 400 })),
    });
    await Azure.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('get file header - fail unknown', async function () {
    const Azure = mockBlobClient({
      getProperties: sinon.stub().throws(azureError({ code: 'unknown' })),
    });
    await Azure.getFileHeader(meta, dataFile);
    assert.strictEqual(meta['resultStatus'], resultStatus.ERROR);
  });

  it('upload - success', async function () {
    const Azure = mockBlobClient({ upload: sinon.stub().resolves() });
    stubFs(4);
    await Azure.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
  });

  it('upload - fail expired token', async function () {
    const Azure = mockBlobClient({
      upload: sinon
        .stub()
        .throws(
          azureError({ statusCode: 403, message: 'Server failed to authenticate the request.' }),
        ),
    });
    stubFs(4);
    await Azure.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
  });

  it('upload - fail HTTP 400', async function () {
    const Azure = mockBlobClient({ upload: sinon.stub().throws(azureError({ statusCode: 400 })) });
    stubFs(4);
    await Azure.uploadFile(dataFile, meta, encryptionMetadata);
    assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
  });

  describe('Multipart upload', () => {
    const MULTIPART_FILE_SIZE = MULTIPART_THRESHOLD_BYTES + MULTIPART_PART_SIZE_BYTES + 1024 * 1024;

    before(() => {
      snowflake.configure({ enableExperimentalMultipartUploads: true });
    });

    after(() => {
      snowflake.configure({ enableExperimentalMultipartUploads: false });
    });

    it('small file uses single block path', async function () {
      const upload = sinon.stub().resolves();
      const stageBlock = sinon.stub().resolves();
      const commitBlockList = sinon.stub().resolves();
      const Azure = mockBlobClient({ upload, stageBlock, commitBlockList });
      stubFs(4);

      await Azure.uploadFile(dataFile, meta, encryptionMetadata);

      assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
      assert.strictEqual(upload.callCount, 1);
      assert.strictEqual(stageBlock.callCount, 0);
      assert.strictEqual(commitBlockList.callCount, 0);
    });

    it('engages multipart path when file exceeds the multipart threshold', async () => {
      const expectedBlocks = Math.ceil(MULTIPART_FILE_SIZE / MULTIPART_PART_SIZE_BYTES);
      const upload = sinon.stub().resolves();
      const stageBlock = sinon.stub().resolves();
      const commitBlockList = sinon.stub().resolves();
      const deleteIfExists = sinon.stub().resolves();
      const Azure = mockBlobClient({ upload, stageBlock, commitBlockList, deleteIfExists });
      stubFs(MULTIPART_FILE_SIZE);

      await Azure.uploadFile(dataFile, meta, encryptionMetadata);

      assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
      assert.strictEqual(upload.callCount, 0);
      assert.strictEqual(stageBlock.callCount, expectedBlocks);
      assert.strictEqual(commitBlockList.callCount, 1);
      assert.strictEqual(deleteIfExists.callCount, 0);

      // Block IDs are ascending fixed-width base64; decoded form is `NNNNNNNNNN`.
      const passedBlockIds = commitBlockList.firstCall.args[0];
      assert.strictEqual(passedBlockIds.length, expectedBlocks);
      const decoded = passedBlockIds.map((id) => Buffer.from(id, 'base64').toString());
      const expectedDecoded = Array.from({ length: expectedBlocks }, (_, i) =>
        String(i + 1).padStart(10, '0'),
      );
      assert.deepStrictEqual(decoded, expectedDecoded);

      // Metadata + headers travel on commit, not on stageBlock.
      const commitOpts = commitBlockList.firstCall.args[1];
      assert.strictEqual(commitOpts.metadata.sfcdigest, mockDigest);
      assert.ok(commitOpts.metadata.encryptiondata, 'encryption envelope present');
      assert.strictEqual(commitOpts.blobHTTPHeaders.blobContentType, 'application/octet-stream');
    });

    it('cleans up on stageBlock failure', async () => {
      const stageBlock = sinon.stub();
      stageBlock.onFirstCall().resolves();
      stageBlock.onSecondCall().throws(azureError({ statusCode: 500, message: 'boom' }));
      const commitBlockList = sinon.stub().resolves();
      const deleteIfExists = sinon.stub().resolves();
      const Azure = mockBlobClient({ stageBlock, commitBlockList, deleteIfExists });
      stubFs(MULTIPART_THRESHOLD_BYTES + MULTIPART_PART_SIZE_BYTES + 1024);

      await Azure.uploadFile(dataFile, meta, encryptionMetadata);

      assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
      assert.strictEqual(stageBlock.callCount, 2);
      assert.strictEqual(commitBlockList.callCount, 0);
      assert.strictEqual(deleteIfExists.callCount, 1);
    });

    it('suppresses cleanup error', async () => {
      const stageBlock = sinon.stub();
      stageBlock.onFirstCall().resolves();
      stageBlock
        .onSecondCall()
        .throws(azureError({ statusCode: 500, message: 'staged block 2 boom' }));
      const deleteIfExists = sinon.stub().throws(new Error('cleanup boom'));
      const Azure = mockBlobClient({ stageBlock, deleteIfExists });
      stubFs(MULTIPART_THRESHOLD_BYTES + MULTIPART_PART_SIZE_BYTES);

      await Azure.uploadFile(dataFile, meta, encryptionMetadata);

      assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
      assert.strictEqual(meta['lastError'].message, 'staged block 2 boom');
    });
  });
});
