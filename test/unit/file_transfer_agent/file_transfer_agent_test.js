const assert = require('assert');
const mock = require('mock-require');
const sinon = require('sinon');
const fs = require('fs');
const os = require('os');
const path = require('path');
const resultStatus = require('../../../lib/file_util').resultStatus;

// file_transfer_agent.js hard-requires these; intercept them by their resolved
// absolute path so the agent under test picks up our stubs.
const STMT_PATH = require.resolve('../../../lib/connection/statement');
const RSU_PATH = require.resolve('../../../lib/file_transfer_agent/remote_storage_util');
const FTA_PATH = require.resolve('../../../lib/file_transfer_agent/file_transfer_agent');

// A GCS upload session uses one credential style throughout: a scoped access
// token OR presigned URLs, never a mix. When the stage resolution returns an
// access token, the connector must NOT re-resolve the stage per file (the token
// already covers the whole staging directory, so one resolution suffices for
// every file). Re-resolving is wasteful and — for versioned stages whose path
// carries a per-PUT segment — unsafe, because the re-resolved path would no
// longer match the path the original token is scoped to (403). When the
// resolution returns no token, the legacy presigned-URL flow re-resolves per
// file to mint each object's signed URL.
describe('FileTransferAgent GCS upload stage resolution', function () {
  let tmpDir;
  let sendRawSpy;
  let capturedMetas;
  let FileTransferAgent;

  function makeStageInfo({ withToken, location }) {
    return {
      locationType: 'GCS',
      location,
      region: 'us-central1',
      presignedUrl: null,
      creds: withToken ? { GCS_ACCESS_TOKEN: 'mock-token' } : {},
    };
  }

  function setupMocks(reResolveStageInfo) {
    capturedMetas = [];
    sendRawSpy = sinon.stub().resolves({ data: { data: { stageInfo: reResolveStageInfo } } });

    mock(STMT_PATH, {
      createContext: () => ({}),
      sendRawQueryRequest: sendRawSpy,
    });
    mock(RSU_PATH, {
      RemoteStorageUtil: function () {
        const record = (meta) => {
          capturedMetas.push(meta);
          meta.resultStatus = resultStatus.UPLOADED;
          meta.dstFileSize = meta.uploadSize || 0;
        };
        return {
          createClient: () => ({ gcsToken: 'mock-token' }),
          uploadOneFileWithRetry: async (meta) => record(meta),
          uploadOneFileStream: async (meta) => record(meta),
          getFileHeader: async () => null,
        };
      },
      SnowflakeFileEncryptionMaterial: function () {},
    });

    FileTransferAgent = mock.reRequire(FTA_PATH);
  }

  function makeContext(stageInfo) {
    const command = `PUT 'file://${tmpDir}/*' 'snow://workspace/DB.SC.WS/versions/live/d/' auto_compress=false overwrite=true`;
    return {
      connectionConfig: {},
      services: {},
      sqlText: command,
      fileMetadata: {
        data: {
          command: 'UPLOAD',
          autoCompress: false,
          sourceCompression: 'gzip',
          parallel: 1,
          stageInfo,
          overwrite: true,
          src_locations: [`${tmpDir}/*`],
        },
      },
    };
  }

  beforeEach(function () {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fta-gcs-'));
    for (const name of ['a.txt', 'b.txt', 'c.txt']) {
      fs.writeFileSync(path.join(tmpDir, name), `data-${name}`);
    }
  });

  afterEach(function () {
    // Stop only the modules we mocked (not mock.stopAll()) so sibling test
    // files that rely on their own mock-require registrations are unaffected.
    mock.stop(STMT_PATH);
    mock.stop(RSU_PATH);
    sinon.restore();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('access-token mode: does NOT re-resolve the stage; all files upload under the single original resolution', async function () {
    const original = makeStageInfo({
      withToken: true,
      location: 'bucket/stages/uuid/versions/33_x/1111/d/',
    });
    // If a re-resolution wrongly happened it would return this divergent path.
    setupMocks(
      makeStageInfo({ withToken: true, location: 'bucket/stages/uuid/versions/33_x/9999/d/' }),
    );

    await new FileTransferAgent(makeContext(original)).execute();

    assert.strictEqual(sendRawSpy.callCount, 0, 'no second stage resolution in access-token mode');
    assert.strictEqual(capturedMetas.length, 3, 'all 3 files in the folder were uploaded');
    for (const meta of capturedMetas) {
      assert.strictEqual(
        meta.stageInfo,
        original,
        'each file keeps the original (single) stageInfo',
      );
      assert.ok(!meta.presignedUrl, 'no presigned URL minted in access-token mode');
    }
  });

  it('presigned-URL mode: re-resolves once per destination file to mint each presigned URL', async function () {
    const original = makeStageInfo({
      withToken: false,
      location: 'bucket/stages/uuid/versions/33_x/1111/d/',
    });
    const reResolved = {
      ...makeStageInfo({ withToken: false, location: 'bucket/stages/uuid/versions/33_x/2222/d/' }),
      presignedUrl: 'https://signed.example/obj',
    };
    setupMocks(reResolved);

    await new FileTransferAgent(makeContext(original)).execute();

    assert.strictEqual(sendRawSpy.callCount, 3, 'one re-resolution per destination file');
    assert.strictEqual(capturedMetas.length, 3);
    for (const meta of capturedMetas) {
      assert.strictEqual(meta.presignedUrl, 'https://signed.example/obj', 'presigned URL applied');
    }
  });
});
