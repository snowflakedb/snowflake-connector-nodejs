/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const { runWireMockAsync, addWireMockMappingsFromFile  } = require('../wiremockRunner');
const connParameters = require('../authentication/connectionParameters');
const AuthTest = require('../authentication/authTestsBaseClass');
const testUtil = require('../integration/testUtil');

describe('Connection test', function () {
  let port;
  let authTest;
  let wireMock;

  this.timeout(180000);

  before(async () => {
    port = await testUtil.getFreePort();
    wireMock = await runWireMockAsync(port);
  });
  beforeEach(async () => {
    authTest = new AuthTest();
  });
  afterEach(async () => {
    wireMock.scenarios.resetAllScenarios();
  });
  after(async () => {
    await wireMock.global.shutdown();
  });
  it('Test retries - Connection reset', async function () {
    // snowflake.configure({
    //   logLevel: "DEBUG",
    //   disableOCSPChecks: true
    // });
    await addWireMockMappingsFromFile(wireMock, 'wiremock/mappings/six_reset_connection_and_correct_response.json');
    const connectionOption = { ...connParameters.wiremock, password: 'MOCK_TOKEN', port: port };
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
    await authTest.verifyConnectionIsUp();
  });
  it('Test retries - Malformed response', async function () {
    // snowflake.configure({
    //   logLevel: "DEBUG",
    //   disableOCSPChecks: true
    // });
    await addWireMockMappingsFromFile(wireMock, 'wiremock/mappings/six_malformed_and_correct.json');
    const connectionOption = { ...connParameters.wiremock, password: 'MOCK_TOKEN', port: port };
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
    await authTest.verifyConnectionIsUp();
  });
});


