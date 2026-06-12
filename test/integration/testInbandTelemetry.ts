import sinon from 'sinon';
import assert from 'assert';
import rewiremock from 'rewiremock/node';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../wiremockRunner';
import * as testUtil from './testUtil';
import axiosInstance from '../../lib/http/axios_instance';
import { getFreePort } from '../../lib/util';

describe('Inband Telemetry', () => {
  let wiremock: any;
  let connection: any;
  let axiosRequestSpy: sinon.SinonSpy;

  async function initConnection(coreInstance?: any) {
    connection = testUtil.createConnection(
      {
        accessUrl: wiremock.rootUrl,
      },
      coreInstance?.default,
    );
    await testUtil.connectAsync(connection);
  }

  function getTelemetryRequests() {
    return axiosRequestSpy
      .getCalls()
      .filter((call) => call.firstArg.url?.includes('/telemetry/send'));
  }

  function getTelemetryLogsByType(type: string) {
    return getTelemetryRequests()
      .flatMap((call) => call.firstArg.data?.logs ?? [])
      .filter((log: any) => log?.message?.type === type);
  }

  before(async () => {
    const port = await getFreePort();
    wiremock = await runWireMockAsync(port);
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

  it('minicore error is logged once user is logged in', async () => {
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/login_request_ok.json');
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/telemetry_send_ok.json');
    sinon.stub(process, 'platform').value('dummy-test-platform-to-force-load-error');
    const freshCoreInstance = rewiremock.proxy('../../lib/snowflake', {
      '../../lib/minicore': rewiremock.proxy('../../lib/minicore/minicore'),
    });

    await initConnection(freshCoreInstance);
    await testUtil.sleepAsync(50); // Wait a bit for the async telemetry request to be sent

    const expectedErrorRegexp = new RegExp(
      `Cannot find module './binaries/sf_mini_core_0.0.1.dummy-test-platform-to-force-load-error`,
      'i',
    );
    const minicoreLogs = getTelemetryLogsByType('minicore_error');
    assert.strictEqual(minicoreLogs.length, 1);
    const minicoreLog = minicoreLogs[0];
    assert.match(minicoreLog.message.value.binaryName, /dummy-test-platform-to-force-load-error/);
    assert.match(minicoreLog.message.value.message, expectedErrorRegexp);
    assert.match(minicoreLog.message.value.stack, expectedErrorRegexp);
  });

  it('client_connection_identifier_shape is logged once per successful login', async () => {
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/login_request_ok.json');
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/telemetry_send_ok.json');

    await initConnection();
    await testUtil.sleepAsync(50); // Wait a bit for the async telemetry request to be sent

    const shapeLogs = getTelemetryLogsByType('client_connection_identifier_shape');
    assert.strictEqual(shapeLogs.length, 1);
  });

  it('client_connection_identifier_shape is suppressed when env-switch is engaged', async () => {
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/login_request_ok.json');
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/telemetry_send_ok.json');
    sinon.stub(process, 'env').value({
      ...process.env,
      SF_TELEMETRY_DISABLE_CONNECTION_SHAPE: 'true',
    });

    await initConnection();
    await testUtil.sleepAsync(50); // Wait a bit for the async telemetry request to be sent

    const shapeLogs = getTelemetryLogsByType('client_connection_identifier_shape');
    assert.strictEqual(shapeLogs.length, 0);
  });
});
