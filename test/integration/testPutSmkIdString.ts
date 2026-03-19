import assert from 'assert';
import rewiremock from 'rewiremock/node';
import os from 'os';
import path from 'path';

const OriginalFileTransferAgent = require('../../lib/file_transfer_agent/file_transfer_agent');

// NOTE:
// Keeping this test just in case we get issues with CLIENT_CAPABILITIES.
// DO NOT migrate this test to the Universal Driver.
describe('smkId patching in PUT statements', () => {
  let testUtil: any;
  let fileTransferAgentUsedContext: any;

  function getTmpFilePath() {
    const tmpFile = testUtil.createTempFile(os.tmpdir(), testUtil.createRandomFileName(), '');
    return process.platform === 'win32'
      ? `${process.env.USERPROFILE}\\AppData\\Local\\Temp\\${path.basename(tmpFile)}`
      : tmpFile;
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
    const putFilePath = getTmpFilePath();
    await testUtil.connectAsync(connection);
    await testUtil.executeCmdAsync(connection, `PUT file://${putFilePath} @~/test_smkId_in_put`);
    assert.strictEqual(
      typeof fileTransferAgentUsedContext.fileMetadata.data.encryptionMaterial.smkId,
      'string',
      'smkId should be a string',
    );
  });
});
