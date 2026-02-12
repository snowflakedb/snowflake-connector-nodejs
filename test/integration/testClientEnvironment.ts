import sinon from 'sinon';
import assert from 'assert';
import rewiremock from 'rewiremock/node';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../wiremockRunner';
import * as testUtil from './testUtil';
import axiosInstance from '../../lib/http/axios_instance';
import { WIP_ConnectionOptions } from '../../lib/connection/types';

describe('CLIENT_ENVIRONMENT for /login-request', () => {
  let wiremock: any;
  let connection: any;
  let axiosRequestSpy: sinon.SinonSpy;

  async function initConnection(
    connectionOptions?: Partial<WIP_ConnectionOptions>,
    coreInstance?: any,
  ) {
    connection = testUtil.createConnection(
      {
        accessUrl: wiremock.rootUrl,
        ...connectionOptions,
      },
      coreInstance,
    );
    await testUtil.connectAsync(connection);
  }

  function getClientEnvironment() {
    const request = axiosRequestSpy.firstCall.firstArg;
    return request.data.data.CLIENT_ENVIRONMENT;
  }

  before(async () => {
    const port = await testUtil.getFreePort();
    wiremock = await runWireMockAsync(port);
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/login_request_ok.json');
  });

  beforeEach(async () => {
    axiosRequestSpy = sinon.spy(axiosInstance, 'request');
  });

  afterEach(async () => {
    sinon.restore();
  });

  after(async () => {
    await wiremock.global.shutdown();
  });

  it('contains APPLICATION if passed in connection config', async () => {
    await initConnection({ application: 'test-application' });
    assert.strictEqual(getClientEnvironment().APPLICATION, 'test-application');
  });

  it('contains APPLICATION_PATH', async () => {
    await initConnection();
    assert.ok(getClientEnvironment().APPLICATION_PATH, 'APPLICATION_PATH should not be empty');
  });

  it('contains instruction set architecture (ISA)', async () => {
    await initConnection();
    assert.strictEqual(getClientEnvironment().ISA, process.arch);
  });

  it('contains CORE_ metadata values when minicore is loaded', async () => {
    await initConnection();
    const clientEnvironment = getClientEnvironment();
    assert.strictEqual(clientEnvironment.CORE_VERSION, '0.0.1');
    assert.ok(
      clientEnvironment.CORE_FILE_NAME.includes('sf_mini_core_0.0.1'),
      `Unexpected CORE_BINARY_NAME: ${clientEnvironment.CORE_BINARY_NAME}`,
    );
    assert.strictEqual(clientEnvironment.CORE_LOAD_ERROR, null);
  });

  it('contains CORE_LOAD_ERROR when minicore fails to load', async () => {
    sinon.stub(process, 'platform').value('dummy-test-platform-to-force-load-error');
    const freshCoreInstance = rewiremock.proxy('../../lib/snowflake', {
      '../../lib/minicore': rewiremock.proxy('../../lib/minicore/minicore'),
    });
    await initConnection({}, freshCoreInstance);
    const clientEnvironment = getClientEnvironment();
    assert.strictEqual(clientEnvironment.CORE_VERSION, null);
    assert.ok(
      clientEnvironment.CORE_FILE_NAME.includes('sf_mini_core_0.0.1'),
      `Unexpected CORE_BINARY_NAME: ${clientEnvironment.CORE_BINARY_NAME}`,
    );
    assert.strictEqual(clientEnvironment.CORE_LOAD_ERROR, 'Failed to load binary');
  });

  it('contains OS_DETAILS on Linux or null on other platforms', async () => {
    await initConnection();
    const osDetails = getClientEnvironment().OS_DETAILS;
    if (process.platform === 'linux') {
      assert.ok(
        osDetails !== null && Object.keys(osDetails).length >= 1,
        'OS_DETAILS should contain at least 1 key on Linux',
      );
    } else {
      assert.strictEqual(osDetails, null);
    }
  });

  it('contains PLATFORM field with mocked lambda env', async () => {
    sinon.stub(process.env, 'LAMBDA_TASK_ROOT').value('/var/task');
    const freshPlatformDetection = rewiremock.proxy('../../lib/telemetry/platform_detection');
    const freshCoreInstance = rewiremock.proxy('../../lib/snowflake', {
      '../../lib/services/sf': rewiremock.proxy('../../lib/services/sf', {
        '../../lib/telemetry/platform_detection': freshPlatformDetection,
      }),
    });
    await initConnection({}, freshCoreInstance);
    const platform = getClientEnvironment().PLATFORM;
    assert.ok(Array.isArray(platform), 'PLATFORM should be an array');
    assert.ok(
      platform.includes('is_aws_lambda'),
      `Expected PLATFORM to include is_aws_lambda, got: ${JSON.stringify(platform)}`,
    );
  });
});
