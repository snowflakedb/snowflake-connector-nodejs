/*
 * Verifies that a process-wide minimum TLS version (`node --tls-min-v1.3`) is honored on
 * every connection the connector makes - the Snowflake API and stage transfers alike.
 *
 * Stage transfers matter separately because they do not go through the connector's own
 * HTTPS agents: S3 uploads run on the AWS SDK's HTTP stack, which only receives a
 * connector-supplied agent when a proxy is configured. A TLS floor that covered only the
 * API connection would pass a test against Snowflake and still leak a TLS 1.2 handshake
 * to cloud storage.
 *
 * The driver runs in a child process (see tls_min_version_runner.ts) because the floor is
 * process-wide and because NODE_EXTRA_CA_CERTS is only read at startup.
 */
import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import {
  generateSelfSignedCertificate,
  startMockSnowflakeServer,
  startMockStorageServer,
  GeneratedCertificate,
  MockTlsServer,
} from '../tls_version_mocks';
import { RESULT_MARKER, RunnerResult } from '../tls_min_version_runner';

const REPO_ROOT = path.join(__dirname, '..', '..');
const RUNNER_PATH = path.join(REPO_ROOT, 'test', 'tls_min_version_runner.ts');
/*
 * Reach the mocks by IPv4 literal rather than "localhost". The mock servers listen on
 * 127.0.0.1, and on Node 18 - which has no happy-eyeballs (`autoSelectFamily` arrived in
 * Node 20) - "localhost" resolves to ::1 first, so the driver gets ECONNREFUSED instead of
 * reaching the mock. The generated certificate carries a 127.0.0.1 SAN for this reason.
 */
const MOCK_HOST = '127.0.0.1';
/** Matches the TLS protocol-version failures OpenSSL reports on either side of the handshake. */
const TLS_VERSION_ERROR = /EPROTO|unsupported protocol|protocol version|SSL routines/i;

interface RunDriverOptions {
  accessUrl: string;
  caCertPath: string;
  putFilePath?: string;
  /** When set, the child process runs with a TLS 1.3 floor. */
  enforceTls13?: boolean;
}

function runDriver(options: RunDriverOptions): Promise<RunnerResult> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TLS_TEST_ACCESS_URL: options.accessUrl,
    NODE_EXTRA_CA_CERTS: options.caCertPath,
    // Keep the child from reaching for the public OCSP response cache.
    SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED: 'false',
  };
  if (options.putFilePath) {
    env.TLS_TEST_PUT_FILE = options.putFilePath;
  }
  if (options.enforceTls13) {
    env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --tls-min-v1.3`.trim();
  }

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-r', 'ts-node/register', RUNNER_PATH], {
      cwd: REPO_ROOT,
      env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      const line = stdout.split('\n').find((l) => l.startsWith(RESULT_MARKER));
      if (!line) {
        reject(
          new Error(
            `runner produced no result (exit ${code})\nstdout: ${stdout}\nstderr: ${stderr}`,
          ),
        );
        return;
      }
      resolve(JSON.parse(line.slice(RESULT_MARKER.length)) as RunnerResult);
    });
  });
}

describe('minimum TLS version enforcement', () => {
  let certificate: GeneratedCertificate;
  let tmpDir: string;
  let caCertPath: string;
  let putFilePath: string;

  before(() => {
    certificate = generateSelfSignedCertificate('localhost');
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tls-min-version-'));
    caCertPath = path.join(tmpDir, 'ca.pem');
    fs.writeFileSync(caCertPath, certificate.cert);
    putFilePath = path.join(tmpDir, 'tls-min-version.csv');
    fs.writeFileSync(putFilePath, 'a,b,c\n1,2,3\n');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('rejects the Snowflake connection when the server cannot reach the TLS 1.3 floor', async () => {
    const snowflakeServer = await startMockSnowflakeServer({
      certificate,
      tlsVersion: 'TLSv1.2',
    });

    try {
      const result = await runDriver({
        accessUrl: `https://${MOCK_HOST}:${snowflakeServer.port}`,
        caCertPath,
        enforceTls13: true,
      });

      assert.match(
        result.connect,
        TLS_VERSION_ERROR,
        `expected a TLS protocol-version error, got: ${result.connect}`,
      );
      assert.doesNotMatch(
        result.connect,
        /certificate/i,
        `expected the version to fail the handshake before certificate validation, got: ${result.connect}`,
      );
      assert.deepStrictEqual(
        snowflakeServer.acceptedProtocols,
        [],
        'no handshake should have completed',
      );
      assert.ok(
        snowflakeServer.rejectedHandshakes.length > 0,
        'the server should have refused at least one handshake',
      );
      assert.deepStrictEqual(
        snowflakeServer.requests,
        [],
        'no request should have reached the server',
      );
    } finally {
      await snowflakeServer.shutdown();
    }
  });

  describe('with the Snowflake API at TLS 1.3 and cloud storage capped at TLS 1.2', () => {
    let snowflakeServer: MockTlsServer;
    let storageServer: MockTlsServer;

    beforeEach(async () => {
      storageServer = await startMockStorageServer(certificate, 'TLSv1.2');
      snowflakeServer = await startMockSnowflakeServer({
        certificate,
        tlsVersion: 'TLSv1.3',
        storageEndpoint: `${MOCK_HOST}:${storageServer.port}`,
        putFilePath,
      });
    });

    afterEach(async () => {
      await Promise.all([snowflakeServer.shutdown(), storageServer.shutdown()]);
    });

    it('rejects the stage transfer under the TLS 1.3 floor, without downgrading', async () => {
      const result = await runDriver({
        accessUrl: `https://${MOCK_HOST}:${snowflakeServer.port}`,
        caCertPath,
        putFilePath,
        enforceTls13: true,
      });

      assert.strictEqual(
        result.connect,
        'ok',
        `the API connection should still succeed at TLS 1.3, got: ${result.connect}`,
      );
      assert.deepStrictEqual(
        [...new Set(snowflakeServer.acceptedProtocols)],
        ['TLSv1.3'],
        'the API connection should have negotiated TLS 1.3',
      );

      // The PUT must fail, it must name the TLS cause rather than reporting "Unknown Error
      // in uploading a file", and it must fail without ever completing a handshake below
      // the floor.
      assert.notStrictEqual(result.put, 'ok', 'the PUT must not have succeeded');
      assert.match(
        result.put ?? '',
        TLS_VERSION_ERROR,
        `expected the PUT to report the TLS protocol-version failure, got: ${result.put}`,
      );
      assert.deepStrictEqual(
        storageServer.acceptedProtocols,
        [],
        'the storage endpoint must not have completed any handshake - no silent downgrade',
      );
      assert.ok(
        storageServer.rejectedHandshakes.length > 0,
        'the storage endpoint should have refused at least one handshake',
      );
      assert.ok(
        storageServer.rejectedHandshakes.every((code) => /PROTOCOL|VERSION/i.test(code)),
        `every refusal should be a protocol-version failure, saw: ${JSON.stringify(
          storageServer.rejectedHandshakes,
        )}`,
      );
    });

    // Control: proves the failure above is caused by the floor rather than by the mocks.
    it('completes the same stage transfer at TLS 1.2 when no floor is set', async () => {
      const result = await runDriver({
        accessUrl: `https://${MOCK_HOST}:${snowflakeServer.port}`,
        caCertPath,
        putFilePath,
      });

      assert.strictEqual(result.connect, 'ok', `connection failed: ${result.connect}`);
      assert.ok(
        storageServer.acceptedProtocols.includes('TLSv1.2'),
        `the storage endpoint should have negotiated TLS 1.2, saw: ${JSON.stringify(
          storageServer.acceptedProtocols,
        )}`,
      );
      assert.strictEqual(result.put, 'ok', `the PUT should have succeeded, got: ${result.put}`);
    });
  });
});
