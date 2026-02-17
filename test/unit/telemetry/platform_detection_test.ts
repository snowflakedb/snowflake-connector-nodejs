import assert from 'assert';
import sinon from 'sinon';
import rewiremock from 'rewiremock/node';

describe('getDetectedPlatforms()', () => {
  afterEach(() => {
    sinon.restore();
  });

  function getFreshModule() {
    return rewiremock.proxy(
      '../../../lib/telemetry/platform_detection',
    ) as typeof import('../../../lib/telemetry/platform_detection');
  }

  it('returns empty array when no platform env vars are set', () => {
    sinon.stub(process, 'env').value({});
    const { getDetectedPlatforms } = getFreshModule();
    assert.deepStrictEqual(getDetectedPlatforms(), []);
  });

  it('ignores empty string values for env vars', () => {
    sinon.stub(process, 'env').value({ LAMBDA_TASK_ROOT: '' });
    const { getDetectedPlatforms } = getFreshModule();
    assert.deepStrictEqual(getDetectedPlatforms(), []);
  });

  it('caches the result after first call', () => {
    sinon.stub(process, 'env').value({});
    const { getDetectedPlatforms } = getFreshModule();
    const first = getDetectedPlatforms();
    sinon.stub(process, 'env').value({ LAMBDA_TASK_ROOT: '/var/task' });
    const second = getDetectedPlatforms();
    assert.strictEqual(first, second, 'Should return the same cached array reference');
    assert.deepStrictEqual(second, []);
  });

  it('detects AWS Lambda when LAMBDA_TASK_ROOT is set', () => {
    sinon.stub(process, 'env').value({ LAMBDA_TASK_ROOT: '/var/task' });
    const { getDetectedPlatforms } = getFreshModule();
    assert.deepStrictEqual(getDetectedPlatforms(), ['is_aws_lambda']);
  });

  it('detects Azure Function when all required env vars are set', () => {
    sinon.stub(process, 'env').value({
      FUNCTIONS_WORKER_RUNTIME: 'node',
      FUNCTIONS_EXTENSION_VERSION: '~4',
      AzureWebJobsStorage: 'DefaultEndpointsProtocol=https;...',
    });
    const { getDetectedPlatforms } = getFreshModule();
    assert.deepStrictEqual(getDetectedPlatforms(), ['is_azure_function']);
  });

  it('detects GCE Cloud Run Service when K_SERVICE, K_REVISION, K_CONFIGURATION are set', () => {
    sinon.stub(process, 'env').value({
      K_SERVICE: 'my-service',
      K_REVISION: 'my-service-00001-abc',
      K_CONFIGURATION: 'my-service',
    });
    const { getDetectedPlatforms } = getFreshModule();
    assert.deepStrictEqual(getDetectedPlatforms(), ['is_gce_cloud_run_service']);
  });

  it('detects GCE Cloud Run Job when CLOUD_RUN_JOB, CLOUD_RUN_EXECUTION are set', () => {
    sinon.stub(process, 'env').value({
      CLOUD_RUN_JOB: 'my-job',
      CLOUD_RUN_EXECUTION: 'my-job-abc123',
    });
    const { getDetectedPlatforms } = getFreshModule();
    assert.deepStrictEqual(getDetectedPlatforms(), ['is_gce_cloud_run_job']);
  });

  it('returns multiple platforms when multiple sets of env vars are present', () => {
    sinon.stub(process, 'env').value({
      LAMBDA_TASK_ROOT: '/var/task',
      CLOUD_RUN_JOB: 'my-job',
      CLOUD_RUN_EXECUTION: 'my-job-abc123',
    });
    const { getDetectedPlatforms } = getFreshModule();
    assert.deepStrictEqual(getDetectedPlatforms(), ['is_aws_lambda', 'is_gce_cloud_run_job']);
  });
});
