import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import rewiremock from 'rewiremock/node';
import sinon from 'sinon';

import { resultStatus } from '../../../lib/file_util';

describe('RemoteStorageUtil encrypted downloads', () => {
  let testDir: string;
  let tmpDir: string;

  beforeEach(async () => {
    testDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'remote-storage-test-'));
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'remote-storage-decrypt-'));
  });

  afterEach(async () => {
    sinon.restore();
    await fs.promises.rm(testDir, { recursive: true, force: true });
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  function createRemoteStorageUtil(decryptFile: sinon.SinonStub) {
    function EncryptUtilMock() {
      return { decryptFile };
    }

    const remoteStorageModule = rewiremock.proxy(
      '../../../lib/file_transfer_agent/remote_storage_util',
      {
        [require.resolve('../../../lib/file_transfer_agent/encrypt_util')]: {
          EncryptUtil: EncryptUtilMock,
        },
      },
    ) as typeof import('../../../lib/file_transfer_agent/remote_storage_util');

    return new remoteStorageModule.RemoteStorageUtil({});
  }

  function createMeta(locationType = 'S3') {
    return {
      stageInfo: {
        locationType,
        location: 'bucket/prefix',
      },
      srcFileName: 'encrypted-file',
      dstFileName: 'encrypted-file',
      localLocation: testDir,
      encryptionMaterial: { queryStageMasterKey: 'key' },
      tmpDir,
      parallel: 1,
      noSleepingTime: true,
    };
  }

  it('does not download when every header request fails', async () => {
    const decryptFile = sinon.stub();
    const storageClient = createRemoteStorageUtil(decryptFile);
    const headerError = Object.assign(new Error('throttled'), {
      name: 'SlowDown',
      $metadata: { httpStatusCode: 503 },
    });
    const getFileHeader = sinon.stub().callsFake(async (meta) => {
      meta.lastError = headerError;
      meta.resultStatus = resultStatus.NEED_RETRY;
      return null;
    });
    const nativeDownloadFile = sinon.stub();
    storageClient.getForStorageType = () => ({ getFileHeader, nativeDownloadFile });
    const meta = createMeta();

    await assert.rejects(
      async () => {
        await storageClient.downloadOneFile(meta);
      },
      (err: Error) =>
        err.message.includes('S3:SlowDown:503:HeadObject') &&
        !err.message.includes('encryptionMetadata'),
    );

    assert.strictEqual(getFileHeader.callCount, 5);
    assert.strictEqual(nativeDownloadFile.callCount, 0);
    assert.strictEqual(decryptFile.callCount, 0);
    assert.strictEqual(fs.existsSync(path.join(testDir, meta.dstFileName)), false);
  });

  it('does not download while an Azure header failure is retrying', async () => {
    const decryptFile = sinon.stub();
    const storageClient = createRemoteStorageUtil(decryptFile);
    const headerError = Object.assign(new Error('service unavailable'), {
      code: 'ServerBusy',
      statusCode: 503,
    });
    const getFileHeader = sinon.stub().callsFake(async (meta) => {
      meta.lastError = headerError;
      meta.resultStatus = resultStatus.NEED_RETRY;
      return null;
    });
    const nativeDownloadFile = sinon.stub();
    storageClient.getForStorageType = () => ({ getFileHeader, nativeDownloadFile });
    const meta = createMeta('AZURE');

    await assert.rejects(
      async () => {
        await storageClient.downloadOneFile(meta);
      },
      (err: Error) =>
        err.message.includes('AZURE:ServerBusy:503:GetProperties') &&
        !err.message.includes('encryptionMetadata'),
    );

    assert.strictEqual(getFileHeader.callCount, 5);
    assert.strictEqual(nativeDownloadFile.callCount, 0);
    assert.strictEqual(decryptFile.callCount, 0);
  });

  it('retries the header and decrypts after the storage error recovers', async () => {
    const encryptionMetadata = { key: 'encrypted-key', iv: 'iv', matDesc: '{}' };
    const decryptedFile = path.join(tmpDir, 'decrypted-file');
    const decryptFile = sinon.stub().callsFake(async (metadata) => {
      assert.strictEqual(metadata, encryptionMetadata);
      await fs.promises.writeFile(decryptedFile, 'plaintext');
      return decryptedFile;
    });
    const storageClient = createRemoteStorageUtil(decryptFile);
    const headerError = Object.assign(new Error('throttled'), {
      name: 'SlowDown',
      $metadata: { httpStatusCode: 503 },
    });
    const getFileHeader = sinon.stub();
    getFileHeader.onFirstCall().callsFake(async (meta) => {
      meta.lastError = headerError;
      meta.resultStatus = resultStatus.NEED_RETRY;
      return null;
    });
    getFileHeader.onSecondCall().callsFake(async (meta) => {
      meta.resultStatus = resultStatus.UPLOADED;
      return { contentLength: 10, encryptionMetadata };
    });
    const nativeDownloadFile = sinon.stub().callsFake(async (meta, destination) => {
      await fs.promises.writeFile(destination, 'ciphertext');
      meta.resultStatus = resultStatus.DOWNLOADED;
    });
    storageClient.getForStorageType = () => ({ getFileHeader, nativeDownloadFile });
    const meta = createMeta();

    await storageClient.downloadOneFile(meta);

    assert.strictEqual(getFileHeader.callCount, 2);
    assert.strictEqual(nativeDownloadFile.callCount, 1);
    assert.strictEqual(decryptFile.callCount, 1);
    assert.strictEqual(
      await fs.promises.readFile(path.join(testDir, meta.dstFileName), 'utf8'),
      'plaintext',
    );
  });
});
