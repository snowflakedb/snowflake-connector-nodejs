import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sinon from 'sinon';

const { RemoteStorageUtil } = require('../../../lib/file_transfer_agent/remote_storage_util');
const { S3Util } = require('../../../lib/file_transfer_agent/s3_util');

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
});
