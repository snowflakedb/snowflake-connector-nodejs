import sinon from 'sinon';
import assert from 'assert';
import rewiremock from 'rewiremock/node';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../wiremockRunner';
import * as testUtil from './testUtil';
import axiosInstance from '../../lib/http/axios_instance';

describe('Inband Telemetry', () => {
  let wiremock: any;
  let connection: any;
  let axiosRequestSpy: sinon.SinonSpy;

  async function initConnection(coreInstance?: any) {
    connection = testUtil.createConnection(
      {
        accessUrl: wiremock.rootUrl,
      },
      coreInstance,
    );
    await testUtil.connectAsync(connection);
  }

  function getTelemetryRequests() {
    return axiosRequestSpy
      .getCalls()
      .filter((call) => call.firstArg.url?.includes('/telemetry/send'));
  }

  before(async () => {
    const port = await testUtil.getFreePort();
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
    const logEntry = getTelemetryRequests()[0].firstArg.data.logs[0];
    assert.strictEqual(logEntry.message.type, 'minicore_error');
    assert.match(logEntry.message.value.message, expectedErrorRegexp);
    assert.match(logEntry.message.value.stack, expectedErrorRegexp);
  });
});
