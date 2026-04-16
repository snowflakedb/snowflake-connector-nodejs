import assert from 'assert';
import sinon from 'sinon';
import rewiremock from 'rewiremock/node';

describe('getDetectedPlatforms()', () => {
  interface MockRoute {
    match: (url: string) => boolean;
    status: number;
    body: string;
    headers?: Record<string, string>;
  }

  function stubFetchWithRoutes(routes: MockRoute[]) {
    sinon.stub(globalThis, 'fetch').callsFake(async (input) => {
      const url = String(input);
      const route = routes.find((r) => r.match(url));
      if (route) {
        return new Response(route.body, {
          status: route.status,
          headers: route.headers,
        });
      }
      throw new TypeError('fetch failed');
    });
  }

  afterEach(() => {
    sinon.restore();
  });

  const FAILING_STS_MOCK = {
    '@aws-sdk/client-sts': {
      STSClient: class {
        send() {
          return Promise.reject(new Error('not available'));
        }
      },
      GetCallerIdentityCommand: class {},
    },
  };

  function getFreshModule(mocks: Record<string, any> = {}) {
    return rewiremock.proxy('../../../lib/telemetry/platform_detection', {
      ...FAILING_STS_MOCK,
      ...mocks,
    }) as typeof import('../../../lib/telemetry/platform_detection');
  }

  describe('env-based detectors', () => {
    beforeEach(() => {
      stubFetchWithRoutes([]);
    });

    it('returns empty array when no platform env vars are set', async () => {
      sinon.stub(process, 'env').value({});
      const { getDetectedPlatforms } = getFreshModule();
      assert.deepStrictEqual(await getDetectedPlatforms(), []);
    });

    it('ignores empty string values for env vars', async () => {
      sinon.stub(process, 'env').value({ LAMBDA_TASK_ROOT: '' });
      const { getDetectedPlatforms } = getFreshModule();
      assert.deepStrictEqual(await getDetectedPlatforms(), []);
    });

    it('caches the result after first call', async () => {
      sinon.stub(process, 'env').value({});
      const { getDetectedPlatforms } = getFreshModule();
      const first = await getDetectedPlatforms();
      sinon.stub(process, 'env').value({ LAMBDA_TASK_ROOT: '/var/task' });
      const second = await getDetectedPlatforms();
      assert.strictEqual(first, second, 'returns the same cached array reference');
      assert.deepStrictEqual(second, []);
    });

    it('detects AWS Lambda when LAMBDA_TASK_ROOT is set', async () => {
      sinon.stub(process, 'env').value({ LAMBDA_TASK_ROOT: '/var/task' });
      const { getDetectedPlatforms } = getFreshModule();
      assert.ok((await getDetectedPlatforms()).includes('is_aws_lambda'));
    });

    it('detects Azure Function when all required env vars are set', async () => {
      sinon.stub(process, 'env').value({
        FUNCTIONS_WORKER_RUNTIME: 'node',
        FUNCTIONS_EXTENSION_VERSION: '~4',
        AzureWebJobsStorage: 'DefaultEndpointsProtocol=https;...',
      });
      const { getDetectedPlatforms } = getFreshModule();
      assert.ok((await getDetectedPlatforms()).includes('is_azure_function'));
    });

    it('detects GCE Cloud Run Service when K_SERVICE, K_REVISION, K_CONFIGURATION are set', async () => {
      sinon.stub(process, 'env').value({
        K_SERVICE: 'my-service',
        K_REVISION: 'my-service-00001-abc',
        K_CONFIGURATION: 'my-service',
      });
      const { getDetectedPlatforms } = getFreshModule();
      assert.ok((await getDetectedPlatforms()).includes('is_gce_cloud_run_service'));
    });

    it('detects GCE Cloud Run Job when CLOUD_RUN_JOB, CLOUD_RUN_EXECUTION are set', async () => {
      sinon.stub(process, 'env').value({
        CLOUD_RUN_JOB: 'my-job',
        CLOUD_RUN_EXECUTION: 'my-job-abc123',
      });
      const { getDetectedPlatforms } = getFreshModule();
      assert.ok((await getDetectedPlatforms()).includes('is_gce_cloud_run_job'));
    });

    it('detects GitHub Actions when GITHUB_ACTIONS is set', async () => {
      sinon.stub(process, 'env').value({ GITHUB_ACTIONS: 'true' });
      const { getDetectedPlatforms } = getFreshModule();
      assert.ok((await getDetectedPlatforms()).includes('is_github_action'));
    });

    it('returns multiple platforms when multiple sets of env vars are present', async () => {
      sinon.stub(process, 'env').value({
        LAMBDA_TASK_ROOT: '/var/task',
        CLOUD_RUN_JOB: 'my-job',
        CLOUD_RUN_EXECUTION: 'my-job-abc123',
      });
      const { getDetectedPlatforms } = getFreshModule();
      const platforms = await getDetectedPlatforms();
      assert.ok(platforms.includes('is_aws_lambda'));
      assert.ok(platforms.includes('is_gce_cloud_run_job'));
    });
  });

  describe('SNOWFLAKE_DISABLE_PLATFORM_DETECTION', () => {
    it('returns ["disabled"] when set to "true"', async () => {
      sinon.stub(process, 'env').value({ SNOWFLAKE_DISABLE_PLATFORM_DETECTION: 'true' });
      const { getDetectedPlatforms } = getFreshModule();
      assert.deepStrictEqual(await getDetectedPlatforms(), ['disabled']);
    });

    it('returns ["disabled"] when set to "TRUE" (case-insensitive)', async () => {
      sinon.stub(process, 'env').value({ SNOWFLAKE_DISABLE_PLATFORM_DETECTION: 'TRUE' });
      const { getDetectedPlatforms } = getFreshModule();
      assert.deepStrictEqual(await getDetectedPlatforms(), ['disabled']);
    });

    it('does not disable when set to a non-true value', async () => {
      sinon.stub(process, 'env').value({ SNOWFLAKE_DISABLE_PLATFORM_DETECTION: 'false' });
      stubFetchWithRoutes([]);
      const { getDetectedPlatforms } = getFreshModule();
      const platforms = await getDetectedPlatforms();
      assert.ok(!platforms.includes('disabled'));
    });
  });

  describe('network-based detectors', () => {
    it('detects EC2 instance when IMDS returns identity document', async () => {
      sinon.stub(process, 'env').value({});
      stubFetchWithRoutes([
        {
          match: (url) => url.includes('169.254.169.254') && url.includes('instance-identity'),
          status: 200,
          body: JSON.stringify({ instanceId: 'i-12345' }),
        },
      ]);
      const { getDetectedPlatforms } = getFreshModule();
      assert.ok((await getDetectedPlatforms()).includes('is_ec2_instance'));
    });

    it('does not detect EC2 when IMDS returns non-200', async () => {
      sinon.stub(process, 'env').value({});
      stubFetchWithRoutes([
        {
          match: (url) => url.includes('169.254.169.254') && url.includes('instance-identity'),
          status: 404,
          body: '',
        },
      ]);
      const { getDetectedPlatforms } = getFreshModule();
      assert.ok(!(await getDetectedPlatforms()).includes('is_ec2_instance'));
    });

    it('detects Azure VM when metadata service returns 200', async () => {
      sinon.stub(process, 'env').value({});
      stubFetchWithRoutes([
        {
          match: (url) => url.includes('169.254.169.254') && url.includes('/metadata/instance'),
          status: 200,
          body: '{}',
        },
      ]);
      const { getDetectedPlatforms } = getFreshModule();
      assert.ok((await getDetectedPlatforms()).includes('is_azure_vm'));
    });

    it('detects Azure managed identity via env vars shortcut', async () => {
      sinon.stub(process, 'env').value({
        FUNCTIONS_WORKER_RUNTIME: 'node',
        FUNCTIONS_EXTENSION_VERSION: '~4',
        AzureWebJobsStorage: 'DefaultEndpointsProtocol=https;...',
        IDENTITY_HEADER: 'some-header',
      });
      stubFetchWithRoutes([]);
      const { getDetectedPlatforms } = getFreshModule();
      assert.ok((await getDetectedPlatforms()).includes('has_azure_managed_identity'));
    });

    it('detects Azure managed identity via metadata token endpoint', async () => {
      sinon.stub(process, 'env').value({});
      stubFetchWithRoutes([
        {
          match: (url) =>
            url.includes('169.254.169.254') && url.includes('/metadata/identity/oauth2/token'),
          status: 200,
          body: '{}',
        },
      ]);
      const { getDetectedPlatforms } = getFreshModule();
      assert.ok((await getDetectedPlatforms()).includes('has_azure_managed_identity'));
    });

    it('detects GCE VM when metadata server returns Metadata-Flavor header', async () => {
      sinon.stub(process, 'env').value({});
      stubFetchWithRoutes([
        {
          match: (url) => url.includes('metadata.google.internal'),
          status: 200,
          body: '',
          headers: { 'Metadata-Flavor': 'Google' },
        },
      ]);
      const { getDetectedPlatforms } = getFreshModule();
      assert.ok((await getDetectedPlatforms()).includes('is_gce_vm'));
    });

    it('detects GCP identity when service account email endpoint returns 200', async () => {
      sinon.stub(process, 'env').value({});
      stubFetchWithRoutes([
        {
          match: (url) =>
            url.includes('metadata.google.internal') && url.includes('service-accounts'),
          status: 200,
          body: 'default@project.iam.gserviceaccount.com',
        },
      ]);
      const { getDetectedPlatforms } = getFreshModule();
      assert.ok((await getDetectedPlatforms()).includes('has_gcp_identity'));
    });

    it('gracefully handles connection errors for all network detectors', async () => {
      sinon.stub(process, 'env').value({});
      stubFetchWithRoutes([]);
      const { getDetectedPlatforms } = getFreshModule();
      const platforms = await getDetectedPlatforms();
      assert.deepStrictEqual(platforms, []);
    });
  });

  describe('has_aws_identity', () => {
    it('detects AWS identity with valid IAM user ARN', async () => {
      sinon.stub(process, 'env').value({});
      stubFetchWithRoutes([]);
      const { getDetectedPlatforms } = getFreshModule({
        '@aws-sdk/client-sts': {
          STSClient: class {
            send() {
              return Promise.resolve({
                Arn: 'arn:aws:iam::123456789012:user/test-user',
              });
            }
          },
          GetCallerIdentityCommand: class {},
        },
      });
      assert.ok((await getDetectedPlatforms()).includes('has_aws_identity'));
    });

    it('detects AWS identity with valid assumed-role ARN', async () => {
      sinon.stub(process, 'env').value({});
      stubFetchWithRoutes([]);
      const { getDetectedPlatforms } = getFreshModule({
        '@aws-sdk/client-sts': {
          STSClient: class {
            send() {
              return Promise.resolve({
                Arn: 'arn:aws:sts::123456789012:assumed-role/my-role/session',
              });
            }
          },
          GetCallerIdentityCommand: class {},
        },
      });
      assert.ok((await getDetectedPlatforms()).includes('has_aws_identity'));
    });

    it('rejects invalid ARN patterns', async () => {
      sinon.stub(process, 'env').value({});
      stubFetchWithRoutes([]);
      const { getDetectedPlatforms } = getFreshModule({
        '@aws-sdk/client-sts': {
          STSClient: class {
            send() {
              return Promise.resolve({
                Arn: 'arn:aws:iam::123456789012:role/not-valid-for-wif',
              });
            }
          },
          GetCallerIdentityCommand: class {},
        },
      });
      assert.ok(!(await getDetectedPlatforms()).includes('has_aws_identity'));
    });

    it('returns false when STS call fails', async () => {
      sinon.stub(process, 'env').value({});
      stubFetchWithRoutes([]);
      const { getDetectedPlatforms } = getFreshModule({
        '@aws-sdk/client-sts': {
          STSClient: class {
            send() {
              return Promise.reject(new Error('no credentials'));
            }
          },
          GetCallerIdentityCommand: class {},
        },
      });
      assert.ok(!(await getDetectedPlatforms()).includes('has_aws_identity'));
    });
  });

  describe('isValidArnForWif', () => {
    it('accepts IAM user ARN', () => {
      const { isValidArnForWif } = getFreshModule();
      assert.ok(isValidArnForWif('arn:aws:iam::123456789012:user/my-user'));
    });

    it('accepts assumed-role ARN', () => {
      const { isValidArnForWif } = getFreshModule();
      assert.ok(isValidArnForWif('arn:aws:sts::123456789012:assumed-role/my-role/session'));
    });

    it('rejects IAM role ARN', () => {
      const { isValidArnForWif } = getFreshModule();
      assert.ok(!isValidArnForWif('arn:aws:iam::123456789012:role/my-role'));
    });

    it('rejects empty string', () => {
      const { isValidArnForWif } = getFreshModule();
      assert.ok(!isValidArnForWif(''));
    });

    it('accepts ARNs from non-standard partitions', () => {
      const { isValidArnForWif } = getFreshModule();
      assert.ok(isValidArnForWif('arn:aws-cn:iam::123456789012:user/my-user'));
      assert.ok(isValidArnForWif('arn:aws-us-gov:sts::123456789012:assumed-role/role/sess'));
    });
  });

  describe('timeout handling', () => {
    it('resolves to false for detectors that exceed timeout', async () => {
      sinon.stub(process, 'env').value({});
      sinon.stub(globalThis, 'fetch').callsFake(() => new Promise(() => {}));
      const { getDetectedPlatforms } = getFreshModule({
        '@aws-sdk/client-sts': {
          STSClient: class {
            send() {
              return new Promise(() => {});
            }
          },
          GetCallerIdentityCommand: class {},
        },
      });
      const platforms = await getDetectedPlatforms();
      assert.deepStrictEqual(platforms, []);
    }).timeout(5000);
  });
});
