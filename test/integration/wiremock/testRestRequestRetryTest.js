const connParameters = require('../../authentication/connectionParameters');
const AuthTest = require('../../authentication/authTestsBaseClass');
const { runWireMockAsync, addWireMockMappingsFromFile } = require('../../wiremockRunner');
const { getFreePort } = require('../../../lib/util');
const testUtil = require('../testUtil');
const assert = require('node:assert');

describe('HTTP 3XX codes Retry', function () {
  let port, authTest, wireMock, connectionOption;

  before(async () => {
    port = await getFreePort();
    wireMock = await runWireMockAsync(port);
    connectionOption = {
      ...connParameters.wiremockAuth,
      ...{
        port: port,
      },
    };
  });

  beforeEach(async () => {
    authTest = new AuthTest();
  });

  afterEach(async () => {
    await wireMock.scenarios.resetAllScenarios();
    await wireMock.mappings.resetAllMappings();
  });

  after(async () => {
    await wireMock.global.shutdown();
  });

  it('test redirect 307', async function () {
    await addWireMockMappingsFromFile(
      wireMock,
      'wiremock/mappings/restRequest/http_307_retry.json',
    );
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
    const rows = await testUtil.executeCmdAsync(authTest.connection, 'Select 1');
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0]['1'], 1);
  });

  it('test redirect 308', async function () {
    await addWireMockMappingsFromFile(
      wireMock,
      'wiremock/mappings/restRequest/http_308_retry.json',
    );
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
    const rows = await testUtil.executeCmdAsync(authTest.connection, 'Select 1');
    assert.strictEqual(rows.length, 1);
    assert.strictEqual(rows[0]['1'], 1);
  });
});
