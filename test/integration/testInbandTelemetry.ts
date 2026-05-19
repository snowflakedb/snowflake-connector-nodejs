import sinon from 'sinon';
import assert from 'assert';
import rewiremock from 'rewiremock/node';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../wiremockRunner';
import * as testUtil from './testUtil';
// lib/snowflake.ts exposes the default `core({...})` instance, but `core`
// itself is a plain `.js` module so the TS surface for `createConnection`
// is `Object`. Cast on import — matches how the existing
// `rewiremock.proxy('../../lib/snowflake', ...).default` consumption in
// the minicore_error test below treats the same module as untyped.
import snowflakeDefault from '../../lib/snowflake';
const snowflake: any = snowflakeDefault;
import axiosInstance from '../../lib/http/axios_instance';
import { getFreePort } from '../../lib/util';
import { DISABLE_CONNECTION_SHAPE_ENV } from '../../lib/telemetry/inband_telemetry';

describe('Inband Telemetry', () => {
  let wiremock: any;
  let connection: any;
  let axiosRequestSpy: sinon.SinonSpy;

  async function initConnection(coreInstance?: any, optionsOverride?: Record<string, unknown>) {
    connection = testUtil.createConnection(
      {
        accessUrl: wiremock.rootUrl,
        ...optionsOverride,
      },
      coreInstance?.default,
    );
    await testUtil.connectAsync(connection);
  }

  // The shape-telemetry tests below bypass `testUtil.createConnection` (and
  // therefore the `connOptions.valid` spread) on purpose: that helper folds
  // in `account`, `host`, and `region` from `SNOWFLAKE_TEST_*` env vars,
  // which would leak into the shape capture and make the assertions
  // environment-dependent (CI runners populate these vars; local dev mostly
  // does not). Building the options object explicitly here keeps the shape
  // payload deterministic regardless of where the suite runs.
  async function initShapeConnection(optionsOverride: Record<string, unknown>) {
    connection = snowflake.createConnection({
      username: 'shape-test-user',
      password: 'shape-test-password',
      ...optionsOverride,
    });
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
    delete process.env[DISABLE_CONNECTION_SHAPE_ENV];
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

    // Bare-locator account (no dot, no dash → neither `account_with_region`
    // nor `account_org_provided` flips) plus explicit accessUrl flips
    // `host_provided` true via the Node-specific accessUrl-as-host collapse.
    await initShapeConnection({
      account: 'shapetestacct',
      accessUrl: wiremock.rootUrl,
    });
    await testUtil.sleepAsync(50);

    const shapeLogs = getTelemetryLogsByType('client_connection_identifier_shape');
    assert.strictEqual(shapeLogs.length, 1);
    const shapeLog = shapeLogs[0];
    assert.deepStrictEqual(shapeLog.message.value, {
      account_provided: 'true',
      account_with_region: 'false',
      account_org_provided: 'false',
      region_provided: 'false',
      host_provided: 'true',
    });
  });

  it('client_connection_identifier_shape reflects org-prefixed dotted account', async () => {
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/login_request_ok.json');
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/telemetry_send_ok.json');

    // Org-prefixed dotted account exercises the dash-on-account-portion-only
    // rule: the `-east-` in `us-east-1` is a region-tail dash and must NOT
    // count towards `account_org_provided` (only the `myorg-myacct` portion
    // before the first `.` does).
    await initShapeConnection({
      account: 'myorg-myacct.us-east-1',
      accessUrl: wiremock.rootUrl,
    });
    await testUtil.sleepAsync(50);

    const shapeLogs = getTelemetryLogsByType('client_connection_identifier_shape');
    assert.strictEqual(shapeLogs.length, 1);
    assert.deepStrictEqual(shapeLogs[0].message.value, {
      account_provided: 'true',
      account_with_region: 'true',
      account_org_provided: 'true',
      region_provided: 'false',
      host_provided: 'true',
    });
  });

  it('client_connection_identifier_shape is suppressed when env-switch is engaged', async () => {
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/login_request_ok.json');
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/telemetry_send_ok.json');

    process.env[DISABLE_CONNECTION_SHAPE_ENV] = 'true';

    await initShapeConnection({
      account: 'shapetestacct',
      accessUrl: wiremock.rootUrl,
    });
    await testUtil.sleepAsync(50);

    const shapeLogs = getTelemetryLogsByType('client_connection_identifier_shape');
    assert.strictEqual(shapeLogs.length, 0);
  });
});
