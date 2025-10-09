import assert from 'assert';
import sinon from 'sinon';
import rewiremock from 'rewiremock/node';
import os from 'os';

const OriginalFileTransferAgent = require('../../lib/file_transfer_agent/file_transfer_agent');

describe('smkId patching in PUT statements', () => {
  let testUtil: any;
  let fileTransferAgentUsedContext: any;

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
    sinon.restore();
    rewiremock.disable();
  });

  it('patches the smkId and passes string value to FileTransferAgent', async () => {
    const tmpFile = testUtil.createTempFile(os.tmpdir(), testUtil.createRandomFileName(), '');

    const connection = testUtil.createConnection();
    await testUtil.connectAsync(connection);
    await testUtil.executeCmdAsync(connection, `PUT file://${tmpFile} @~/test_smkId_in_put`);

    assert.strictEqual(
      typeof fileTransferAgentUsedContext.fileMetadata.data.encryptionMaterial.smkId,
      'string',
      'smkId should be converted to string',
    );
  });
});
