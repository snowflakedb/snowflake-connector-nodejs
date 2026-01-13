import assert from 'assert';
import rewiremock from 'rewiremock/node';
import os from 'os';
import path from 'path';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../wiremockRunner';

const OriginalFileTransferAgent = require('../../lib/file_transfer_agent/file_transfer_agent');

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

  it('patches the smkId and passes string value to FileTransferAgent', async () => {
    const connection = testUtil.createConnection();
    const putFilePath = getTmpFilePath();
    await testUtil.connectAsync(connection);
    await testUtil.executeCmdAsync(connection, `PUT file://${putFilePath} @~/test_smkId_in_put`);
    assert.strictEqual(
      typeof fileTransferAgentUsedContext.fileMetadata.data.encryptionMaterial.smkId,
      'string',
      'smkId should be converted to string',
    );
  });

  describe('wiremock environment', () => {
    let wiremock: any;

    before(async () => {
      const port = await testUtil.getFreePort();
      wiremock = await runWireMockAsync(port);
      await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/login_request_ok.json');
    });

    after(async () => {
      await wiremock.global.shutdown();
    });

    it('patches the smkId and passes string value to FileTransferAgent', async () => {
      const putFilePath = getTmpFilePath();
      const smkIdValue = '900719925474099333';
      await addWireMockMappingsFromFile(
        wiremock,
        'wiremock/mappings/query_put_with_smkid_ok.json.template',
        {
          sendRaw: true,
          replaceVariables: {
            putFilePath,
            smkId: smkIdValue, // bare number in JSON
          },
        },
      );
      const connection = testUtil.createConnection({ accessUrl: wiremock.rootUrl });
      await testUtil.connectAsync(connection);
      await testUtil.executeCmdAsync(connection, `PUT file://${putFilePath} @~/test_smkId_in_put`);
      assert.strictEqual(
        fileTransferAgentUsedContext.fileMetadata.data.encryptionMaterial.smkId,
        smkIdValue,
        'smkId should be converted to string when received as int from server',
      );
    });

    it('handles smkId when it comes as a string from the server', async () => {
      const putFilePath = getTmpFilePath();
      const smkIdValue = '900719925474099333';
      await addWireMockMappingsFromFile(
        wiremock,
        'wiremock/mappings/query_put_with_smkid_ok.json.template',
        {
          sendRaw: true,
          replaceVariables: {
            putFilePath,
            smkId: `"${smkIdValue}"`, // quoted string in JSON
          },
        },
      );
      const connection = testUtil.createConnection({ accessUrl: wiremock.rootUrl });
      await testUtil.connectAsync(connection);
      await testUtil.executeCmdAsync(connection, `PUT file://${putFilePath} @~/test_smkId_in_put`);
      assert.strictEqual(
        fileTransferAgentUsedContext.fileMetadata.data.encryptionMaterial.smkId,
        smkIdValue,
        'smkId should remain a string when received as string from server',
      );
    });
  });
});
