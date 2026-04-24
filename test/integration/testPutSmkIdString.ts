import assert from 'assert';
import rewiremock from 'rewiremock/node';
import os from 'os';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';

const OriginalFileTransferAgent = require('../../lib/file_transfer_agent/file_transfer_agent');

// NOTE:
// Keeping this test just in case we get issues with CLIENT_CAPABILITIES.
// DO NOT migrate this test to the Universal Driver.
describe('smkId in PUT statements', () => {
  let testUtil: any;
  let fileTransferAgentUsedContext: any;

  const FILE_CONTENT = 'smkId-string-test-content\n';
  const STAGE_PATH = '@~/test_smkId_in_put';

  function toPlatformPath(filePath: string) {
    return process.platform === 'win32'
      ? `${process.env.USERPROFILE}\\AppData\\Local\\Temp\\${path.basename(filePath)}`
      : filePath;
  }

  function createTmpFileWithContent() {
    const tmpFile = testUtil.createTempFile(
      os.tmpdir(),
      testUtil.createRandomFileName(),
      FILE_CONTENT,
    );
    return toPlatformPath(tmpFile);
  }

  function createTmpDir() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'get-smkId-'));
    return { realPath: tmpDir, platformPath: toPlatformPath(tmpDir) };
  }

  before(() => {
    rewiremock('../../lib/file_transfer_agent/file_transfer_agent').with(function (context: any) {
      // Context mutates, so we deep clone it
      fileTransferAgentUsedContext = JSON.parse(JSON.stringify(context));
      return new OriginalFileTransferAgent(context);
    });
    rewiremock.enable();
    testUtil = require('./testUtil');
  });

  after(() => {
    rewiremock.disable();
  });

  it('FileTransferAgent receives smkId as string', async () => {
    const connection = testUtil.createConnection();
    const putFilePath = createTmpFileWithContent();
    const { realPath: getDir, platformPath: getDirForQuery } = createTmpDir();
    const fileName = path.basename(putFilePath);

    await testUtil.connectAsync(connection);
    try {
      await testUtil.executeCmdAsync(connection, `PUT file://${putFilePath} ${STAGE_PATH}`);
      assert.strictEqual(
        typeof fileTransferAgentUsedContext.fileMetadata.data.encryptionMaterial.smkId,
        'string',
        'smkId should be a string',
      );

      await testUtil.executeCmdAsync(
        connection,
        `GET ${STAGE_PATH}/${fileName}.gz file://${getDirForQuery}`,
      );
      assert.strictEqual(
        typeof fileTransferAgentUsedContext.fileMetadata.data.encryptionMaterial[0].smkId,
        'string',
        'smkId should be a string on GET as well',
      );

      const downloadedFile = path.join(getDir, `${fileName}.gz`);
      assert.ok(fs.existsSync(downloadedFile), `Downloaded file should exist at ${downloadedFile}`);

      const decompressed = zlib.gunzipSync(fs.readFileSync(downloadedFile)).toString();
      assert.strictEqual(
        decompressed,
        FILE_CONTENT,
        'Downloaded file content should match the uploaded content',
      );
    } finally {
      await testUtil
        .executeCmdAsync(connection, `REMOVE ${STAGE_PATH}/${fileName}.gz`)
        .catch(() => undefined);
      testUtil.deleteFileSyncIgnoringErrors?.(putFilePath);
      fs.rmSync(getDir, { recursive: true, force: true });
    }
  });
});
