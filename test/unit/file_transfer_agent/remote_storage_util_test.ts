import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sinon from 'sinon';

const { RemoteStorageUtil } = require('../../../lib/file_transfer_agent/remote_storage_util');
const { S3Util } = require('../../../lib/file_transfer_agent/s3_util');
const { resultStatus } = require('../../../lib/file_util');

describe('RemoteStorageUtil', () => {
  describe('downloadOneFile', () => {
    let localLocation: string;

    beforeEach(() => {
      localLocation = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-storage-util-test-'));
    });

    afterEach(() => {
      sinon.restore();
      fs.rmSync(localLocation, { recursive: true, force: true });
    });

    const headerError = new Error(
      'Client network socket disconnected before secure TLS connection',
    );
    const downloadOk = {
      $metadata: { httpStatusCode: 200 },
      Body: { transformToByteArray: async () => Buffer.from('mock') },
    };

    function downloadEncryptedFile(getObject: sinon.SinonStub) {
      const s3 = {
        S3: function () {
          return { headObject: sinon.stub().rejects(headerError), getObject, destroy: () => {} };
        },
      };
      const remoteStorageUtil = new RemoteStorageUtil({ getProxy: () => null });
      sinon
        .stub(remoteStorageUtil, 'getForStorageType')
        .returns(new S3Util({ getProxy: () => null }, s3));
      return remoteStorageUtil.downloadOneFile({
        stageInfo: { locationType: 'S3', location: 'bucket/path', creds: {} },
        srcFileName: 'file.csv.gz',
        dstFileName: 'file.csv.gz',
        localLocation,
        encryptionMaterial: { queryStageMasterKey: 'key', queryId: 'queryId', smkId: '1' },
        parallel: 1,
        noSleepingTime: true,
      });
    }

    function isHeaderError(err: Error) {
      return err.message.includes(headerError.message);
    }

    it('surfaces the file header error when decrypting a downloaded file', async () => {
      const getObject = sinon.stub().resolves(downloadOk);

      await assert.rejects(downloadEncryptedFile(getObject), isHeaderError);
      assert.strictEqual(getObject.calledOnce, true);
      assert.strictEqual(fs.existsSync(path.join(localLocation, 'file.csv.gz')), false);
    });

    it('surfaces the file header error, not the error of a retried download', async () => {
      const getObject = sinon.stub();
      getObject.onFirstCall().rejects(new Error('download failed'));
      getObject.onSecondCall().resolves(downloadOk);

      await assert.rejects(downloadEncryptedFile(getObject), isHeaderError);
      assert.strictEqual(getObject.calledTwice, true);
    });
  });

  describe('error after the retries run out', () => {
    let localLocation: string;
    let srcFilePath: string;

    beforeEach(() => {
      localLocation = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-storage-util-test-'));
      srcFilePath = path.join(localLocation, 'data.csv');
      fs.writeFileSync(srcFilePath, 'a,b\n');
    });

    afterEach(() => {
      sinon.restore();
      fs.rmSync(localLocation, { recursive: true, force: true });
    });

    function s3Error() {
      return Object.assign(new Error('UnknownError'), { $metadata: { httpStatusCode: 403 } });
    }
    function azureError() {
      return Object.assign(new Error('Server busy'), { statusCode: 503 });
    }
    function gcsError() {
      return Object.assign(new Error('Request failed with status code 500'), {
        response: { status: 500 },
      });
    }

    /** A storage client whose every transfer asks for a retry with `error`. */
    function failingStorageUtil(error: unknown) {
      const needRetry = (meta: Record<string, unknown>) => {
        meta['resultStatus'] = resultStatus.NEED_RETRY;
        meta['lastError'] = error;
      };
      const remoteStorageUtil = new RemoteStorageUtil({ getProxy: () => null });
      sinon.stub(remoteStorageUtil, 'getForStorageType').returns({
        getFileHeader: async () => ({ digest: null, contentLength: 1, encryptionMetadata: null }),
        uploadFile: async (_dataFile: string, meta: Record<string, unknown>) => needRetry(meta),
        uploadFileStream: async (_stream: unknown, meta: Record<string, unknown>) =>
          needRetry(meta),
        nativeDownloadFile: async (meta: Record<string, unknown>) => needRetry(meta),
      });
      return remoteStorageUtil;
    }

    const TRANSFERS: {
      name: string;
      run: (util: typeof RemoteStorageUtil) => Promise<void>;
    }[] = [
      {
        name: 'uploadOneFile',
        run: (util) =>
          util.uploadOneFile({
            stageInfo: { locationType: 'S3' },
            overwrite: true,
            realSrcFilePath: srcFilePath,
            srcFileName: 'data.csv',
            dstFileName: 'data.csv',
            parallel: 1,
            noSleepingTime: true,
          }),
      },
      {
        name: 'uploadOneFileStream',
        run: (util) =>
          util.uploadOneFileStream({
            stageInfo: { locationType: 'S3' },
            overwrite: true,
            fileStream: Buffer.from('a,b\n'),
            srcFileName: 'data.csv',
            dstFileName: 'data.csv',
            parallel: 1,
            noSleepingTime: true,
          }),
      },
      {
        name: 'downloadOneFile',
        run: (util) =>
          util.downloadOneFile({
            stageInfo: { locationType: 'S3', location: 'bucket/path' },
            srcFileName: 'data.csv',
            dstFileName: 'data.csv',
            localLocation,
            parallel: 1,
            noSleepingTime: true,
          }),
      },
    ];

    TRANSFERS.forEach(({ name, run }) => {
      describe(name, () => {
        [
          { cloud: 'S3', error: s3Error, status: 403 },
          { cloud: 'Azure', error: azureError, status: 503 },
          { cloud: 'GCS', error: gcsError, status: 500 },
        ].forEach(({ cloud, error, status }) => {
          it(`appends the HTTP status of a ${cloud} error to its message`, async () => {
            const storageError = error();
            await assert.rejects(run(failingStorageUtil(storageError)), (err: Error) => {
              assert.strictEqual(err.message, `${String(storageError)} (HTTP ${status})`);
              return true;
            });
          });
        });

        [
          { kind: 'an error without an HTTP status', error: new Error('socket hang up') },
          { kind: 'a string error', error: 'read ECONNRESET' },
        ].forEach(({ kind, error }) => {
          it(`keeps the message of ${kind} unchanged`, async () => {
            await assert.rejects(run(failingStorageUtil(error)), (err: Error) => {
              assert.strictEqual(err.message, new Error(error as string).message);
              return true;
            });
          });
        });

        it('does not attach the storage error to the thrown error', async () => {
          await assert.rejects(run(failingStorageUtil(s3Error())), (err: Error) => {
            assert.strictEqual(err.cause, undefined);
            return true;
          });
        });
      });
    });
  });
});
