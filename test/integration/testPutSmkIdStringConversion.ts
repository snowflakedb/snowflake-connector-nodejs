import assert from 'assert';
import { vi } from 'vitest';
import os from 'os';
import path from 'path';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../wiremockRunner';

const OriginalFileTransferAgent = require('../../lib/file_transfer_agent/file_transfer_agent');

// Track the context passed to FileTransferAgent
let fileTransferAgentUsedContext: any;

// Mock the file_transfer_agent module
vi.mock('../../lib/file_transfer_agent/file_transfer_agent', () => {
  return {
    default: function (context: any) {
      // Context mutates, so we deep clone it
      fileTransferAgentUsedContext = JSON.parse(JSON.stringify(context));
      return new OriginalFileTransferAgent(context);
    },
  };
});

describe('smkId patching in PUT statements', () => {
  let testUtil: any;

  function getTmpFilePath() {
    const tmpFile = testUtil.createTempFile(os.tmpdir(), testUtil.createRandomFileName(), '');
    return process.platform === 'win32'
      ? `${process.env.USERPROFILE}\\AppData\\Local\\Temp\\${path.basename(tmpFile)}`
      : tmpFile;
  }

  before(() => {
    testUtil = require('./testUtil');
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

    [Number, String].forEach((smkIdType) => {
      it(`when server retruns smkId as ${smkIdType.name}, FileTransferAgent receives it as string`, async () => {
        const putFilePath = getTmpFilePath();
        const rawSmkIdValue = '900719925474099333';
        await addWireMockMappingsFromFile(
          wiremock,
          'wiremock/mappings/query_put_with_smkid_ok.json.template',
          {
            sendRaw: true,
            replaceVariables: {
              putFilePath,
              rawSmkIdValue: smkIdType === Number ? rawSmkIdValue : `"${rawSmkIdValue}"`,
            },
          },
        );
        const connection = testUtil.createConnection({
          accessUrl: wiremock.rootUrl,
          proxyHost: '127.0.0.1',
          proxyPort: 8080,
        });
        await testUtil.connectAsync(connection);
        await testUtil.executeCmdAsync(
          connection,
          `PUT file://${putFilePath} @~/test_smkId_in_put`,
        );
        assert.strictEqual(
          fileTransferAgentUsedContext.fileMetadata.data.encryptionMaterial.smkId,
          rawSmkIdValue,
          'smkId should be a string',
        );
      });
    });
  });
});
