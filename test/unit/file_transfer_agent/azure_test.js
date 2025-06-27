const assert = require('assert');
let AZURE;
const fs = require('fs');
const sinon = require('sinon');
const SnowflakeAzureUtil = require('./../../../lib/file_transfer_agent/azure_util');
const resultStatus = require('../../../lib/file_util').resultStatus;

let hasAzure = true;
try {
  AZURE = require('@azure/storage-blob');
} catch (err) {
  hasAzure = false;
}

if (hasAzure){
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
        creds: {}
      },
      SHA256_DIGEST: mockDigest,
    };
    const encryptionMetadata = {
      key: mockKey,
      iv: mockIv,
      matDesc: mockMatDesc
    };

    let sinonSandbox;
    const getPropertiesStub = sinon.stub();
    const uploadStub = sinon.stub();

    function verifyNameAndPath(bucketPath, containerName, path) {
      const result = Azure.extractContainerNameAndPath(bucketPath);
      assert.strictEqual(result.containerName, containerName);
      assert.strictEqual(result.path, path);
    }

    before(function () {
      sinonSandbox = sinon.createSandbox();
      sinonSandbox.stub(AZURE, 'BlobServiceClient').returns({
        getContainerClient: () => ({
          getBlobClient: () => ({
            getProperties: getPropertiesStub
          }),
          getBlockBlobClient: () => ({
            upload: uploadStub
          })
        })
      });
      sinonSandbox.stub(fs, 'readFileSync').returnsArg(0);
      Azure = new SnowflakeAzureUtil(noProxyConnectionConfig);
    });

    afterEach(() => {
      getPropertiesStub.reset();
      uploadStub.reset();
    });

    after(() => {
      sinonSandbox.restore();
    });

    it('extract bucket name and path', async function () {
      verifyNameAndPath('sfc-eng-regression/test_sub_dir/', 'sfc-eng-regression', 'test_sub_dir/');
      verifyNameAndPath('sfc-eng-regression/stakeda/test_stg/test_sub_dir/', 'sfc-eng-regression', 'stakeda/test_stg/test_sub_dir/');
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

    it('upload - success', async function () {
      await Azure.uploadFile(dataFile, meta, encryptionMetadata);
      assert.strictEqual(meta['resultStatus'], resultStatus.UPLOADED);
    });

    it('upload - fail expired token', async function () {
      uploadStub.throws(() => {
        const err = new Error('Server failed to authenticate the request.');
        err.statusCode = 403;
        throw err;
      });
      await Azure.uploadFile(dataFile, meta, encryptionMetadata);
      assert.strictEqual(meta['resultStatus'], resultStatus.RENEW_TOKEN);
    });

    it('upload - fail HTTP 400', async function () {
      uploadStub.throws(() => {
        const err = new Error();
        err.statusCode = 400;
        throw err;
      });
      await Azure.uploadFile(dataFile, meta, encryptionMetadata);
      assert.strictEqual(meta['resultStatus'], resultStatus.NEED_RETRY);
    });
  });
}