import sinon from 'sinon';
import assert from 'assert';
import axios from 'axios';
import rewiremock from 'rewiremock/node';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../wiremockRunner';
import * as testUtil from './testUtil';

describe('CLIENT_ENVIRONMENT for /login-request', () => {
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
    axiosRequestSpy = sinon.spy(axios, 'request');
  });

  afterEach(async () => {
    sinon.restore();
  });

  after(async () => {
    await wiremock.global.shutdown();
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
      clientEnvironment.CORE_BINARY_NAME.includes('sf_mini_core_0.0.1'),
      `Unexpected CORE_BINARY_NAME: ${clientEnvironment.CORE_BINARY_NAME}`,
    );
    assert.strictEqual(clientEnvironment.CORE_LOAD_ERROR, null);
  });

  it('contains CORE_LOAD_ERROR when minicore fails to load', async () => {
    sinon.stub(process, 'platform').value('dummy-test-platform-to-force-load-error');
    const freshCoreInstance = rewiremock.proxy('../../lib/snowflake', {
      '../../lib/minicore': rewiremock.proxy('../../lib/minicore/minicore'),
    });
    await initConnection(freshCoreInstance);
    const clientEnvironment = getClientEnvironment();
    assert.strictEqual(clientEnvironment.CORE_VERSION, null);
    assert.ok(
      clientEnvironment.CORE_BINARY_NAME.includes('sf_mini_core_0.0.1'),
      `Unexpected CORE_BINARY_NAME: ${clientEnvironment.CORE_BINARY_NAME}`,
    );
    assert.strictEqual(clientEnvironment.CORE_LOAD_ERROR, 'Failed to load binary');
  });
});
