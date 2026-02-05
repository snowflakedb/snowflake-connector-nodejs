import { vi, type MockInstance } from 'vitest';
import assert from 'assert';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../wiremockRunner';
import * as testUtil from './testUtil';
import axiosInstance from '../../lib/http/axios_instance';

describe('CLIENT_ENVIRONMENT for /login-request', () => {
  let wiremock: any;
  let connection: any;
  let axiosRequestSpy: MockInstance;

  async function initConnection(coreInstance?: any) {
    connection = testUtil.createConnection(
      {
        accessUrl: wiremock.rootUrl,
      },
      coreInstance,
    );
    await testUtil.connectAsync(connection);
  }

  function getClientEnvironment() {
    const request = axiosRequestSpy.mock.calls[0][0] as any;
    return request.data.data.CLIENT_ENVIRONMENT;
  }

  before(async () => {
    const port = await testUtil.getFreePort();
    wiremock = await runWireMockAsync(port);
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/login_request_ok.json');
  });

  beforeEach(async () => {
    axiosRequestSpy = vi.spyOn(axiosInstance, 'request');
  });

  after(async () => {
    await wiremock.global.shutdown();
  });

  it('contains APPLICATION_PATH', async () => {
    await initConnection();
    assert.ok(getClientEnvironment().APPLICATION_PATH, 'APPLICATION_PATH should not be empty');
  });

  it('contains instruction set arhitecture (ISA)', async () => {
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
    vi.spyOn(process, 'platform', 'get').mockReturnValue(
      'dummy-test-platform-to-force-load-error' as NodeJS.Platform,
    );
    vi.resetModules();
    const { default: freshCoreInstance } = await import('../../lib/snowflake');
    await initConnection(freshCoreInstance);
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
});
