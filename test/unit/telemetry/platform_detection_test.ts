import assert from 'assert';
import http from 'node:http';
import { EventEmitter } from 'node:events';
import sinon from 'sinon';
import rewiremock from 'rewiremock/node';

function getFreshModule({
  stsClientSend = () => Promise.reject(new Error('not available')),
}: { stsClientSend?: (...args: any[]) => Promise<any> } = {}) {
  return rewiremock.proxy('../../../lib/telemetry/platform_detection', {
    '@aws-sdk/client-sts': {
      STSClient: class {
        send = stsClientSend;
      },
      GetCallerIdentityCommand: class {},
    },
  }) as typeof import('../../../lib/telemetry/platform_detection');
}

describe('getDetectedPlatforms()', () => {
  interface MockRoute {
    match: (url: string, method: string, headers: Record<string, string>) => boolean;
    status: number;
    body: string;
    headers?: Record<string, string>;
  }

  let httpRequestStub: sinon.SinonStub;
  let httpRequestHandlers: MockRoute[];
  let envStub: sinon.SinonStub;

  beforeEach(() => {
    httpRequestHandlers = [];
    envStub = sinon.stub(process, 'env').value({});
    httpRequestStub = sinon.stub(http, 'request').callsFake((url: any, _opts: any, cb?: any) => {
      const opts = typeof _opts === 'object' && _opts !== null ? _opts : {};
      const callback = typeof _opts === 'function' ? _opts : cb;
      const urlStr = String(url);
      const method = String(opts.method || 'GET').toUpperCase();
      const headers: Record<string, string> = opts.headers || {};
      const route = httpRequestHandlers.find((r) => r.match(urlStr, method, headers));
      const req = new EventEmitter() as http.ClientRequest;
      (req as any).end = () => {};

      if (route) {
        const res = new EventEmitter() as http.IncomingMessage;
        (res as any).statusCode = route.status;
        (res as any).headers = {};
        if (route.headers) {
          for (const [k, v] of Object.entries(route.headers)) {
            (res as any).headers[k.toLowerCase()] = v;
          }
        }
        process.nextTick(() => {
          callback(res);
          res.emit('data', route.body);
          res.emit('end');
        });
      } else {
        process.nextTick(() => req.emit('error', new Error('connect ECONNREFUSED')));
      }
      return req;
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('returns ["disabled"] when SNOWFLAKE_DISABLE_PLATFORM_DETECTION=true', async () => {
    envStub.value({ SNOWFLAKE_DISABLE_PLATFORM_DETECTION: 'true' });
    const { getDetectedPlatforms } = getFreshModule();
    assert.deepStrictEqual(await getDetectedPlatforms(), ['disabled']);
  });

  it('returns [] when all detectors time out (should take ~200ms)', async () => {
    httpRequestStub.callsFake((_url: any, opts: any) => {
      const signal: AbortSignal = opts?.signal;
      const req = new EventEmitter() as http.ClientRequest;
      (req as any).end = () => {};
      if (signal?.aborted) {
        process.nextTick(() => req.emit('error', signal.reason));
      } else {
        signal?.addEventListener('abort', () => req.emit('error', signal.reason));
      }
      return req;
    });
    const start = Date.now();
    const { getDetectedPlatforms, DETECTION_TIMEOUT_MS } = getFreshModule();
    const platforms = await getDetectedPlatforms();
    const elapsed = Date.now() - start;
    assert.deepStrictEqual(platforms, []);
    assert.ok(
      elapsed >= DETECTION_TIMEOUT_MS && elapsed - DETECTION_TIMEOUT_MS < 50,
      `Timeout should be ~${DETECTION_TIMEOUT_MS}ms, but was ${elapsed}ms`,
    );
  });

  it('caches the result after first call', async () => {
    const { getDetectedPlatforms } = getFreshModule();
    const first = await getDetectedPlatforms();
    envStub.value({ LAMBDA_TASK_ROOT: '/var/task' });
    const second = await getDetectedPlatforms();
    assert.strictEqual(first, second);
    assert.deepStrictEqual(second, []);
  });

  it('returns is_aws_lambda when LAMBDA_TASK_ROOT is set', async () => {
    envStub.value({ LAMBDA_TASK_ROOT: '/var/task' });
    const { getDetectedPlatforms } = getFreshModule();
    assert.ok((await getDetectedPlatforms()).includes('is_aws_lambda'));
  });

  it('returns is_azure_function when Azure Functions env vars are set', async () => {
    envStub.value({
      FUNCTIONS_WORKER_RUNTIME: 'node',
      FUNCTIONS_EXTENSION_VERSION: '~4',
      AzureWebJobsStorage: 'DefaultEndpointsProtocol=https;...',
    });
    const { getDetectedPlatforms } = getFreshModule();
    assert.ok((await getDetectedPlatforms()).includes('is_azure_function'));
  });

  it('returns is_gce_cloud_run_service when K_SERVICE, K_REVISION, K_CONFIGURATION are set', async () => {
    envStub.value({
      K_SERVICE: 'my-service',
      K_REVISION: 'my-service-00001-abc',
      K_CONFIGURATION: 'my-service',
    });
    const { getDetectedPlatforms } = getFreshModule();
    assert.ok((await getDetectedPlatforms()).includes('is_gce_cloud_run_service'));
  });

  it('returns is_gce_cloud_run_job when CLOUD_RUN_JOB, CLOUD_RUN_EXECUTION are set', async () => {
    envStub.value({
      CLOUD_RUN_JOB: 'my-job',
      CLOUD_RUN_EXECUTION: 'my-job-abc123',
    });
    const { getDetectedPlatforms } = getFreshModule();
    assert.ok((await getDetectedPlatforms()).includes('is_gce_cloud_run_job'));
  });

  it('returns is_github_action when GITHUB_ACTIONS is set', async () => {
    envStub.value({ GITHUB_ACTIONS: 'true' });
    const { getDetectedPlatforms } = getFreshModule();
    assert.ok((await getDetectedPlatforms()).includes('is_github_action'));
  });

  it('returns multiple platforms when multiple sets of env vars are present', async () => {
    envStub.value({
      LAMBDA_TASK_ROOT: '/var/task',
      CLOUD_RUN_JOB: 'my-job',
      CLOUD_RUN_EXECUTION: 'my-job-abc123',
    });
    const { getDetectedPlatforms } = getFreshModule();
    const platforms = await getDetectedPlatforms();
    assert.ok(platforms.includes('is_aws_lambda'));
    assert.ok(platforms.includes('is_gce_cloud_run_job'));
  });

  describe('is_ec2_instance', () => {
    const TOKEN_URL = '169.254.169.254/latest/api/token';
    const IDENTITY_URL = '169.254.169.254/latest/dynamic/instance-identity/document';

    it('detects via IMDSv2 using token PUT and authenticated GET', async () => {
      let capturedIdentityHeaders: Record<string, string> = {};
      httpRequestHandlers.push({
        match: (url, method) => url.includes(TOKEN_URL) && method === 'PUT',
        status: 200,
        body: 'imds-token',
      });
      httpRequestHandlers.push({
        match: (url, method, headers) => {
          if (!url.includes(IDENTITY_URL) || method !== 'GET') return false;
          capturedIdentityHeaders = headers;
          return true;
        },
        status: 200,
        body: '{ "instanceId": "i-12345" }',
      });
      const { getDetectedPlatforms } = getFreshModule();
      assert.ok((await getDetectedPlatforms()).includes('is_ec2_instance'));
      assert.strictEqual(capturedIdentityHeaders['X-aws-ec2-metadata-token'], 'imds-token');
    });

    it('falls back to IMDSv1 (no token) when IMDSv2 token PUT fails', async () => {
      let capturedIdentityHeaders: Record<string, string> = {};
      httpRequestHandlers.push({
        match: (url, method) => url.includes(TOKEN_URL) && method === 'PUT',
        status: 403,
        body: 'Forbidden',
      });
      httpRequestHandlers.push({
        match: (url, method, headers) => {
          if (!url.includes(IDENTITY_URL) || method !== 'GET') return false;
          capturedIdentityHeaders = headers;
          return true;
        },
        status: 200,
        body: '{ "instanceId": "i-legacy" }',
      });
      const { getDetectedPlatforms } = getFreshModule();
      assert.ok((await getDetectedPlatforms()).includes('is_ec2_instance'));
      assert.strictEqual(capturedIdentityHeaders['X-aws-ec2-metadata-token'], undefined);
    });
  });

  describe('has_aws_identity', () => {
    it('detects with valid IAM user ARN', async () => {
      const { getDetectedPlatforms } = getFreshModule({
        stsClientSend: () => Promise.resolve({ Arn: 'arn:aws:iam::123456789012:user/test-user' }),
      });
      assert.ok((await getDetectedPlatforms()).includes('has_aws_identity'));
    });

    it('detects with valid assumed-role ARN', async () => {
      const { getDetectedPlatforms } = getFreshModule({
        stsClientSend: () =>
          Promise.resolve({ Arn: 'arn:aws:sts::123456789012:assumed-role/my-role/session' }),
      });
      assert.ok((await getDetectedPlatforms()).includes('has_aws_identity'));
    });

    it('does not detect with invalid ARN pattern', async () => {
      const { getDetectedPlatforms } = getFreshModule({
        stsClientSend: () =>
          Promise.resolve({ Arn: 'arn:aws:iam::123456789012:role/not-valid-for-wif' }),
      });
      assert.deepStrictEqual(await getDetectedPlatforms(), []);
    });

    it('does not detect when STS call fails', async () => {
      const { getDetectedPlatforms } = getFreshModule({
        stsClientSend: () => Promise.reject(new Error('no credentials')),
      });
      assert.deepStrictEqual(await getDetectedPlatforms(), []);
    });
  });

  it('returns is_azure_vm when Azure VM metadata service returns 200', async () => {
    httpRequestHandlers.push({
      match: (url) => url.includes('169.254.169.254/metadata/instance'),
      status: 200,
      body: '{}',
    });
    const { getDetectedPlatforms } = getFreshModule();
    assert.ok((await getDetectedPlatforms()).includes('is_azure_vm'));
  });

  describe('has_azure_managed_identity', () => {
    it('detects in Azure Functions', async () => {
      envStub.value({
        FUNCTIONS_WORKER_RUNTIME: 'node',
        FUNCTIONS_EXTENSION_VERSION: '~4',
        AzureWebJobsStorage: 'DefaultEndpointsProtocol=https;...',
        IDENTITY_HEADER: 'some-header',
      });
      const { getDetectedPlatforms } = getFreshModule();
      assert.ok((await getDetectedPlatforms()).includes('has_azure_managed_identity'));
    });

    it('detects in Azure VM', async () => {
      httpRequestHandlers.push({
        match: (url) => url.includes('169.254.169.254/metadata/identity/oauth2/token'),
        status: 200,
        body: '{}',
      });
      const { getDetectedPlatforms } = getFreshModule();
      assert.ok((await getDetectedPlatforms()).includes('has_azure_managed_identity'));
    });
  });

  it('returns is_gce_vm when GCE VM metadata service returns Metadata-Flavor header', async () => {
    httpRequestHandlers.push({
      match: (url) => url.includes('metadata.google.internal'),
      status: 200,
      body: '',
      headers: { 'Metadata-Flavor': 'Google' },
    });
    const { getDetectedPlatforms } = getFreshModule();
    assert.ok((await getDetectedPlatforms()).includes('is_gce_vm'));
  });

  it('returns has_gcp_identity when GCE VM metadata service returns service account email', async () => {
    httpRequestHandlers.push({
      match: (url) =>
        url.includes(
          'metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email',
        ),
      status: 200,
      body: '',
    });
    const { getDetectedPlatforms } = getFreshModule();
    assert.ok((await getDetectedPlatforms()).includes('has_gcp_identity'));
  });
});
