import { WireMockRestClient } from 'wiremock-rest-client';
import { AxiosRequestConfig } from 'axios';
import assert from 'assert';
import sinon from 'sinon';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../../wiremockRunner';
import * as testUtil from '../testUtil';
import * as Util from '../../../lib/util';
import axiosInstance from '../../../lib/http/axios_instance';

// A GCS upload session uses one credential style throughout: presigned URLs OR a
// downscoped access token, never a mix. The two styles differ in how many stage
// resolutions the connector performs, which these tests pin by counting
// /queries/v1/query-request POSTs:
//   - Presigned: stageInfo has no access token, so the connector re-resolves the
//     PUT once per destination file to mint each object's presigned URL
//     (1 initial resolution + N per-file refreshes).
//   - Downscoped token: stageInfo.creds.GCS_ACCESS_TOKEN is folder-scoped and
//     covers every file, so the connector resolves exactly once regardless of
//     file count and never re-resolves.
describe('Query PUT with GCS stage resolution', () => {
  let wiremock: WireMockRestClient;
  let axiosRequestSpy: sinon.SinonSpy;
  let baseConnectionConfig: any = {};
  const tmpFileName = testUtil.createRandomFileName();
  let tmpFilePath: string;
  let tmpDir: string;
  const multiFileNames = ['a.txt', 'b.txt', 'c.txt'];

  before(async () => {
    const port = await Util.getFreePort();
    wiremock = await runWireMockAsync(port);
    baseConnectionConfig = {
      accessUrl: `http://127.0.0.1:${port}`,
    };
    tmpFilePath = testUtil.createTempFile(os.tmpdir(), tmpFileName);
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fta-gcs-'));
    for (const name of multiFileNames) {
      testUtil.createTempFile(tmpDir, name, `data-${name}`);
    }
  });

  beforeEach(async () => {
    axiosRequestSpy = sinon.spy(axiosInstance, 'request');
  });

  afterEach(async () => {
    sinon.restore();
    await wiremock.mappings.resetAllMappings();
  });

  after(async () => {
    testUtil.deleteFileSyncIgnoringErrors(tmpFilePath);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    await wiremock.global.shutdown();
  });

  function getAxiosRequestsCount(matchingPath: string) {
    return axiosRequestSpy.getCalls().filter((c: any) => {
      const reqOptions = c.args![0] as AxiosRequestConfig;
      return reqOptions.url?.includes(matchingPath);
    }).length;
  }

  it('sends two query-requests for a presigned GCS PUT (initial resolution + per-file refresh)', async () => {
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/login_request_ok.json');
    await addWireMockMappingsFromFile(
      wiremock,
      'wiremock/mappings/query_put_gcs_presigned_ok.json.template',
      {
        replaceVariables: {
          putFileName: tmpFileName,
          putFilePath: tmpFilePath,
          wiremockUrl: baseConnectionConfig.accessUrl,
        },
      },
    );
    const connection = testUtil.createConnection(baseConnectionConfig);
    await testUtil.connectAsync(connection);
    await testUtil.executeCmdAsync(connection, `PUT file://${tmpFilePath} @~`);

    const queryRequestsCount = getAxiosRequestsCount('/queries/v1/query-request');
    assert.strictEqual(queryRequestsCount, 2);
  });

  it('sends one query-request for a multi-file GCS PUT in downscoped access-token mode', async () => {
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/login_request_ok.json');
    await addWireMockMappingsFromFile(
      wiremock,
      'wiremock/mappings/query_put_gcs_downscoped_ok.json.template',
      {
        replaceVariables: {
          putGlob: `${tmpDir}/*`,
          wiremockUrl: baseConnectionConfig.accessUrl,
        },
      },
    );
    const connection = testUtil.createConnection(baseConnectionConfig);
    await testUtil.connectAsync(connection);
    await testUtil.executeCmdAsync(connection, `PUT file://${tmpDir}/* @~`);

    const queryRequestsCount = getAxiosRequestsCount('/queries/v1/query-request');
    assert.strictEqual(queryRequestsCount, 1);
  });
});
