/*
 * Verifies PUT/GET retries against every cloud storage client, end to end: WireMock plays
 * both Snowflake (query-request returns the stage info) and the storage endpoint.
 *
 * Transfers can be retried at two layers, which these tests pin by counting the storage
 * requests WireMock received:
 *   - the cloud SDK, per call (AWS SDK: 3 attempts, Azure StorageRetryPolicy: 4 tries,
 *     GCS: plain axios with none)
 *   - the driver's NEED_RETRY loop in remote_storage_util.js (5 attempts)
 */
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import { WireMockRestClient } from 'wiremock-rest-client';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../../wiremockRunner';
import * as testUtil from '../testUtil';
import * as Util from '../../../lib/util';

const AzureStorageBlob = require('@azure/storage-blob');

const DRIVER_ATTEMPTS = 5;
const FILE_NAME = 'data.csv';
const FILE_CONTENT = 'a,b\n1,2\n';
const STAGE_PATH = 'stage/';
const ENCRYPTION_MATERIAL = {
  queryStageMasterKey: 'STAGE_MASTER_KEY',
  queryId: '01c0e577-000b-aba8-0000-4c390147020a',
  smkId: '1234',
};

type StorageResponse = Record<string, unknown>;

interface CloudConfig {
  name: 'S3' | 'AZURE' | 'GCS';
  /** Storage tries per driver attempt; GCS has no SDK, so 1. */
  sdkAttempts: number;
  /** Storage tries per driver attempt for a PUT of a file; the AWS SDK never retries a stream body. */
  filePutSdkAttempts: number;
  /** Requests a successful PUT of a file takes; Azure stages a block, then commits it. */
  filePutRequests: number;
  stageInfo: (ports: { http: number; https: number }) => Record<string, unknown>;
  bucket: string;
  headOk: StorageResponse;
  headNotFound: StorageResponse;
  getOk: StorageResponse;
  putOk: StorageResponse;
}

const CLOUDS: CloudConfig[] = [
  {
    name: 'S3',
    sdkAttempts: 3,
    filePutSdkAttempts: 1,
    filePutRequests: 1,
    // createClient always builds https://<endPoint>, so S3 talks to WireMock's HTTPS port.
    // The dot in the bucket name makes the AWS SDK use path-style URLs.
    bucket: 'test.bucket',
    stageInfo: ({ https }) => ({
      locationType: 'S3',
      location: `test.bucket/${STAGE_PATH}`,
      path: STAGE_PATH,
      region: 'us-west-2',
      creds: {
        AWS_KEY_ID: 'TEST_AWS_KEY_ID',
        AWS_SECRET_KEY: 'TEST_AWS_SECRET_KEY',
        AWS_TOKEN: 'TEST_AWS_TOKEN',
      },
      presignedUrl: null,
      useS3RegionalUrl: false,
      endPoint: `127.0.0.1:${https}`,
    }),
    headOk: { status: 200, headers: { 'x-amz-meta-sfc-digest': 'digest' } },
    headNotFound: { status: 404 },
    getOk: { status: 200, body: FILE_CONTENT },
    putOk: { status: 200, headers: { ETag: '"etag"' } },
  },
  {
    name: 'AZURE',
    sdkAttempts: 4,
    filePutSdkAttempts: 4,
    filePutRequests: 2,
    bucket: 'container',
    stageInfo: ({ http }) => ({
      locationType: 'AZURE',
      location: `container/${STAGE_PATH}`,
      path: STAGE_PATH,
      region: 'westus',
      storageAccount: 'account',
      creds: { AZURE_SAS_TOKEN: '?sv=2020-08-04&sig=mock' },
      presignedUrl: null,
      endPoint: `http://127.0.0.1:${http}`,
    }),
    headOk: {
      status: 200,
      headers: { 'x-ms-meta-sfcdigest': 'digest', 'x-ms-blob-type': 'BlockBlob' },
    },
    headNotFound: { status: 404 },
    getOk: {
      status: 200,
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(FILE_CONTENT.length),
        ETag: '"etag"',
      },
      body: FILE_CONTENT,
    },
    putOk: { status: 201, headers: { ETag: '"etag"' } },
  },
  {
    name: 'GCS',
    sdkAttempts: 1,
    filePutSdkAttempts: 1,
    filePutRequests: 1,
    bucket: 'gcs-bucket',
    stageInfo: ({ http }) => ({
      locationType: 'GCS',
      location: `gcs-bucket/${STAGE_PATH}`,
      path: STAGE_PATH,
      region: 'us-central1',
      creds: { GCS_ACCESS_TOKEN: 'mock-token' },
      presignedUrl: null,
      endPoint: `http://127.0.0.1:${http}`,
    }),
    headOk: { status: 200, headers: { 'x-goog-meta-sfc-digest': 'digest' } },
    headNotFound: { status: 404 },
    getOk: { status: 200, body: FILE_CONTENT },
    putOk: { status: 200 },
  },
];

describe('File transfer retries', () => {
  let wiremock: WireMockRestClient;
  const ports = { http: 0, https: 0 };
  let tmpDir: string;
  let localDir: string;
  let putFilePath: string;

  before(async () => {
    ports.http = await Util.getFreePort();
    ports.https = await Util.getFreePort();
    wiremock = await runWireMockAsync(ports.http, {
      wiremockJarArgs: ['--https-port', String(ports.https)],
    });
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-transfer-retry-'));
    putFilePath = testUtil.createTempFile(tmpDir, FILE_NAME, FILE_CONTENT);
  });

  beforeEach(async () => {
    localDir = fs.mkdtempSync(path.join(tmpDir, 'get-'));
    // Keep the user's AWS environment from changing the SDK's retry behavior.
    const envWithoutAwsRetryConfig = Object.fromEntries(
      Object.entries(process.env).filter(
        ([name]) => name !== 'AWS_MAX_ATTEMPTS' && name !== 'AWS_RETRY_MODE',
      ),
    );
    sinon.stub(process, 'env').value({
      ...envWithoutAwsRetryConfig,
      AWS_CONFIG_FILE: path.join(tmpDir, 'missing-aws-config'),
      // Trust WireMock's self-signed certificate on the S3 HTTPS endpoint.
      NODE_TLS_REJECT_UNAUTHORIZED: '0',
    });
    // The real Azure retry policy, with its default 4s/12s/28s backoff cut to 1ms.
    const RealBlobServiceClient = AzureStorageBlob.BlobServiceClient;
    sinon.stub(AzureStorageBlob, 'BlobServiceClient').callsFake(
      (url: unknown, credential: unknown, options: unknown) =>
        new RealBlobServiceClient(url, credential, {
          ...(options as object),
          retryOptions: { retryDelayInMs: 1, maxRetryDelayInMs: 1 },
        }),
    );
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/login_request_ok.json');
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/telemetry_send_ok.json');
  });

  afterEach(async () => {
    sinon.restore();
    await wiremock.mappings.resetAllMappings();
    await wiremock.requests.deleteAllRequests();
    await wiremock.scenarios.resetAllScenarios();
  });

  after(async () => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    await wiremock.global.shutdown();
  });

  async function stubQueryResponse(data: Record<string, unknown>) {
    await wiremock.mappings.createMapping({
      request: { urlPathPattern: '/queries/v1/query-request.*', method: 'POST' },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        jsonBody: { data, code: null, message: null, success: true },
      },
    });
  }

  function stubPutCommand(
    cloud: CloudConfig,
    { overwrite, fromFileStream = false }: { overwrite: boolean; fromFileStream?: boolean },
  ) {
    return stubQueryResponse({
      command: 'UPLOAD',
      // A fileStream PUT names the staged object after src_locations[0].
      src_locations: [fromFileStream ? FILE_NAME : putFilePath],
      parallel: 1,
      autoCompress: false,
      overwrite,
      sourceCompression: 'auto_detect',
      stageInfo: cloud.stageInfo(ports),
      encryptionMaterial: null,
      queryId: ENCRYPTION_MATERIAL.queryId,
    });
  }

  function stubGetCommand(cloud: CloudConfig, { encrypted }: { encrypted: boolean }) {
    return stubQueryResponse({
      command: 'DOWNLOAD',
      src_locations: [FILE_NAME],
      localLocation: localDir,
      presignedUrls: [],
      parallel: 1,
      stageInfo: cloud.stageInfo(ports),
      encryptionMaterial: encrypted ? [ENCRYPTION_MATERIAL] : null,
      queryId: ENCRYPTION_MATERIAL.queryId,
    });
  }

  function objectUrlPath(cloud: CloudConfig) {
    return `/${cloud.bucket}/${STAGE_PATH}${FILE_NAME}`;
  }

  /** Responds with `failure` for the first `failures` requests, then with `success`. */
  async function stubStorage(
    cloud: CloudConfig,
    method: string,
    {
      failures = 0,
      failure = { status: 503 },
      success,
    }: {
      failures?: number;
      failure?: StorageResponse;
      success: StorageResponse;
    },
  ) {
    const scenarioName = `${cloud.name}-${method}`;
    const request = { method, urlPath: objectUrlPath(cloud) };
    for (let i = 0; i < failures; i++) {
      await wiremock.mappings.createMapping({
        scenarioName,
        requiredScenarioState: i === 0 ? 'Started' : `failed-${i}`,
        newScenarioState: `failed-${i + 1}`,
        request,
        response: failure,
      });
    }
    await wiremock.mappings.createMapping({
      scenarioName,
      requiredScenarioState: failures === 0 ? 'Started' : `failed-${failures}`,
      request,
      response: success,
    });
  }

  async function stubStorageAlwaysFailing(
    cloud: CloudConfig,
    method: string,
    failure: StorageResponse = { status: 503 },
  ) {
    await wiremock.mappings.createMapping({
      request: { method, urlPath: objectUrlPath(cloud) },
      response: failure,
    });
  }

  async function countStorageRequests(cloud: CloudConfig, method: string) {
    const { count } = await wiremock.requests.getCount({
      method,
      urlPath: objectUrlPath(cloud),
    });
    return count;
  }

  async function connect() {
    const connection = testUtil.createConnection({
      accessUrl: `http://127.0.0.1:${ports.http}`,
    });
    await testUtil.connectAsync(connection);
    return connection;
  }

  async function runGet() {
    const connection = await connect();
    const { rows } = await testUtil.executeCmdAsync(
      connection,
      `GET @~/${FILE_NAME} file://${localDir}`,
    );
    assert.strictEqual(rows.length, 1);
    return rows[0];
  }

  async function runPut() {
    const connection = await connect();
    const { rows } = await testUtil.executeCmdAsync(connection, `PUT file://${putFilePath} @~`);
    assert.strictEqual(rows.length, 1);
    return rows[0];
  }

  function assertDownloaded(row: Record<string, unknown>) {
    assert.strictEqual(row.status, 'DOWNLOADED', `unexpected row: ${JSON.stringify(row)}`);
    assert.strictEqual(fs.readFileSync(path.join(localDir, FILE_NAME), 'utf8'), FILE_CONTENT);
  }

  CLOUDS.forEach((cloud) => {
    describe(cloud.name, () => {
      describe('GET', () => {
        it('recovers from transient 503 responses', async () => {
          await stubGetCommand(cloud, { encrypted: false });
          await stubStorage(cloud, 'HEAD', { success: cloud.headOk });
          await stubStorage(cloud, 'GET', { failures: 2, success: cloud.getOk });

          assertDownloaded(await runGet());
          assert.strictEqual(await countStorageRequests(cloud, 'GET'), 3);
        });

        it('recovers from a connection reset', async () => {
          await stubGetCommand(cloud, { encrypted: false });
          await stubStorage(cloud, 'HEAD', { success: cloud.headOk });
          await stubStorage(cloud, 'GET', {
            failures: 1,
            failure: { fault: 'CONNECTION_RESET_BY_PEER' },
            success: cloud.getOk,
          });

          assertDownloaded(await runGet());
          assert.strictEqual(await countStorageRequests(cloud, 'GET'), 2);
        });

        it('recovers from a response body that breaks mid-stream', async () => {
          await stubGetCommand(cloud, { encrypted: false });
          await stubStorage(cloud, 'HEAD', { success: cloud.headOk });
          await stubStorage(cloud, 'GET', {
            failures: 1,
            failure: { status: 200, fault: 'MALFORMED_RESPONSE_CHUNK' },
            success: cloud.getOk,
          });

          assertDownloaded(await runGet());
          assert.strictEqual(await countStorageRequests(cloud, 'GET'), 2);
        });

        if (cloud.sdkAttempts > 1) {
          it('retries in the driver after the SDK gives up', async () => {
            await stubGetCommand(cloud, { encrypted: false });
            await stubStorage(cloud, 'HEAD', { success: cloud.headOk });
            await stubStorage(cloud, 'GET', {
              failures: cloud.sdkAttempts + 1,
              success: cloud.getOk,
            });

            assertDownloaded(await runGet());
            assert.strictEqual(await countStorageRequests(cloud, 'GET'), cloud.sdkAttempts + 2);
          });
        }

        it('gives up after the driver and SDK retries run out', async () => {
          await stubGetCommand(cloud, { encrypted: false });
          await stubStorage(cloud, 'HEAD', { success: cloud.headOk });
          await stubStorageAlwaysFailing(cloud, 'GET');

          const row = await runGet();
          assert.strictEqual(row.status, 'ERROR');
          assert.strictEqual(
            await countStorageRequests(cloud, 'GET'),
            cloud.sdkAttempts * DRIVER_ATTEMPTS,
          );
        });

        it('reports the file header error for an encrypted file instead of decrypting it', async () => {
          await stubGetCommand(cloud, { encrypted: true });
          await stubStorageAlwaysFailing(cloud, 'HEAD', { status: 500 });
          await stubStorage(cloud, 'GET', { success: cloud.getOk });

          const row = await runGet();
          assert.strictEqual(row.status, 'ERROR');
          assert.doesNotMatch(String(row.message), /encryptionMetadata/);
          assert.strictEqual(fs.existsSync(path.join(localDir, FILE_NAME)), false);
          assert.strictEqual(await countStorageRequests(cloud, 'HEAD'), cloud.sdkAttempts);
        });
      });

      describe('PUT', () => {
        it('recovers from transient 503 responses', async () => {
          await stubPutCommand(cloud, { overwrite: true });
          await stubStorage(cloud, 'HEAD', { success: cloud.headOk });
          await stubStorage(cloud, 'PUT', { failures: 2, success: cloud.putOk });

          const row = await runPut();
          assert.strictEqual(row.status, 'UPLOADED');
          assert.strictEqual(await countStorageRequests(cloud, 'PUT'), 2 + cloud.filePutRequests);
        });

        it('recovers from a connection reset', async () => {
          await stubPutCommand(cloud, { overwrite: true });
          await stubStorage(cloud, 'HEAD', { success: cloud.headOk });
          await stubStorage(cloud, 'PUT', {
            failures: 1,
            failure: { fault: 'CONNECTION_RESET_BY_PEER' },
            success: cloud.putOk,
          });

          const row = await runPut();
          assert.strictEqual(row.status, 'UPLOADED');
          assert.strictEqual(await countStorageRequests(cloud, 'PUT'), 1 + cloud.filePutRequests);
        });

        it('sends the full body on every retry of a fileStream upload', async () => {
          await stubPutCommand(cloud, { overwrite: true, fromFileStream: true });
          await stubStorage(cloud, 'HEAD', { success: cloud.headOk });
          await stubStorage(cloud, 'PUT', { failures: 2, success: cloud.putOk });

          // A fileStream PUT (used for bind uploads) returns no rows; it rejects on failure.
          await testUtil.executeCmdAsync(await connect(), `PUT file://${FILE_NAME} @~`, {
            fileStream: Buffer.from(FILE_CONTENT),
          });
          const { requests } = await wiremock.requests.findRequests({
            method: 'PUT',
            urlPath: objectUrlPath(cloud),
          });
          assert.strictEqual(requests.length, 3);
          for (const request of requests) {
            assert.ok(
              String(request.body).includes(FILE_CONTENT),
              `PUT body is missing the file content: ${request.body}`,
            );
          }
        });

        it('gives up after the driver and SDK retries run out', async () => {
          await stubPutCommand(cloud, { overwrite: true });
          await stubStorage(cloud, 'HEAD', { success: cloud.headOk });
          await stubStorageAlwaysFailing(cloud, 'PUT');

          await assert.rejects(runPut());
          assert.strictEqual(
            await countStorageRequests(cloud, 'PUT'),
            cloud.filePutSdkAttempts * DRIVER_ATTEMPTS,
          );
        });

        it('gives up when the file header check keeps failing', async () => {
          await stubPutCommand(cloud, { overwrite: false });
          await stubStorageAlwaysFailing(cloud, 'HEAD');
          await stubStorage(cloud, 'PUT', { success: cloud.putOk });

          await assert.rejects(runPut());
          assert.strictEqual(
            await countStorageRequests(cloud, 'HEAD'),
            cloud.sdkAttempts * DRIVER_ATTEMPTS,
          );
          assert.strictEqual(await countStorageRequests(cloud, 'PUT'), 0);
        });

        if (cloud.name !== 'GCS') {
          // GCS reuses the header from its own upload response, so it sends no follow-up HEAD.
          it('keeps a successful upload when the follow-up file header check fails', async () => {
            await stubPutCommand(cloud, { overwrite: false });
            await stubStorage(cloud, 'HEAD', {
              failures: 1,
              failure: cloud.headNotFound,
              success: { status: 500 },
            });
            await stubStorage(cloud, 'PUT', { success: cloud.putOk });

            const row = await runPut();
            assert.strictEqual(row.status, 'UPLOADED');
            assert.strictEqual(await countStorageRequests(cloud, 'PUT'), cloud.filePutRequests);
          });
        }
      });
    });
  });
});
