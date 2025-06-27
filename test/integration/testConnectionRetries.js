/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const { runWireMockAsync, addWireMockMappingsFromFile  } = require('../wiremockRunner');
const connParameters = require('../authentication/connectionParameters');
const testUtil = require('../integration/testUtil');
const snowflake = require('../../lib/snowflake');
const assert = require('assert');

describe('Connection test', function () {
  this.timeout(500000);
  let port;
  let wireMock;

  before(async () => {
    port = await testUtil.getFreePort();
    wireMock = await runWireMockAsync(port);
    snowflake.configure({
      logLevel: 'DEBUG',
      disableOCSPChecks: true
    });
  });

  afterEach(async () => {
    wireMock.scenarios.resetAllScenarios();
  });

  after(async () => {
    await wireMock.global.shutdown();
  });

  it('Test retries after connection reset - success', async function () {
    await addWireMockMappingsFromFile(wireMock, 'wiremock/mappings/six_reset_connection_and_correct_response.json');
    const connectionOption = { ...connParameters.wiremock, password: 'MOCK_TOKEN', port: port, sfRetryMaxSleepTime: 2, sfRetryMaxNumRetries: 10 };
    const connection = testUtil.createConnection(connectionOption);
    await testUtil.connectAsync(connection);
    await assert.doesNotReject(async () => await testUtil.executeCmdAsync(connection, ' Select 1'));
  });

  it('Test retries after malformed response', async function () {
    await addWireMockMappingsFromFile(wireMock, 'wiremock/mappings/six_malformed_and_correct.json');
    const connectionOption = { ...connParameters.wiremock, password: 'MOCK_TOKEN', port: port, sfRetryMaxSleepTime: 2 };
    const connection = testUtil.createConnection(connectionOption);
    await testUtil.connectAsync(connection);
    await assert.doesNotReject(async () => await testUtil.executeCmdAsync(connection, ' Select 1'));
  });

  it('Test retries after connection reset - fail', async function () {
    await addWireMockMappingsFromFile(wireMock, 'wiremock/mappings/six_reset_connection_and_correct_response.json');
    const connectionOption = { ...connParameters.wiremock, password: 'MOCK_TOKEN', port: port, sfRetryMaxNumRetries: 1, sfRetryMaxSleepTime: 2 };
    const connection = testUtil.createConnection(connectionOption);
    await testUtil.connectAsync(connection);
    await assert.rejects(
      testUtil.executeCmdAsync(connection, ' Select 1'),
      (err) => {
        assert.match(err.message, /Network error. Could not reach Snowflake./);
        return true;
      },
    );
  });
});


