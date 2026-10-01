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

    it('surfaces the file header error when decrypting a downloaded file', async () => {
      const headerError = new Error(
        'Client network socket disconnected before secure TLS connection',
      );
      const getObject = sinon.stub().resolves({
        $metadata: { httpStatusCode: 200 },
        Body: { transformToByteArray: async () => Buffer.from('mock') },
      });
      const s3 = {
        S3: function () {
          return { headObject: sinon.stub().rejects(headerError), getObject, destroy: () => {} };
        },
      };
      const remoteStorageUtil = new RemoteStorageUtil({ getProxy: () => null });
      sinon
        .stub(remoteStorageUtil, 'getForStorageType')
        .returns(new S3Util({ getProxy: () => null }, s3));
      const meta = {
        stageInfo: { locationType: 'S3', location: 'bucket/path', creds: {} },
        srcFileName: 'file.csv.gz',
        dstFileName: 'file.csv.gz',
        localLocation,
        encryptionMaterial: { queryStageMasterKey: 'key', queryId: 'queryId', smkId: '1' },
        parallel: 1,
      };

      await assert.rejects(remoteStorageUtil.downloadOneFile(meta), headerError);
      assert.strictEqual(getObject.calledOnce, true);
    });
  });
});
