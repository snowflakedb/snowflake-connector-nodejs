const connParameters = require('../../authentication/connectionParameters');
const AuthTest = require('../../authentication/authTestsBaseClass');
const { runWireMockAsync, addWireMockMappingsFromFile } = require('../../wiremockRunner');
const { getFreePort } = require('../../../lib/util');

describe('Oauth Client Credentials authentication', function () {
  let port;
  let authTest;
  let wireMock;
  let connectionOption;
  before(async () => {
    port = await getFreePort();
    wireMock = await runWireMockAsync(port);
    connectionOption = { ...connParameters.oauthClientCredentialsOnWiremock,
      ...{
        port: port,
        oauthAuthorizationUrl: `https://127.0.0.1:${port}/oauth/authorize`,
        oauthTokenRequestUrl: `http://127.0.0.1:${port}/oauth/token-request`,
      }
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

  it('Successful flow scenario Client Credentials flow', async function () {
    await addWireMockMappingsFromFile(wireMock, 'wiremock/mappings/oauth/client_credentials/successful_flow.json');
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
    await authTest.verifyConnectionIsUp();
  });

  //invalidCode test
  it('Client Credentials flow - invalid code', async function () {
    await addWireMockMappingsFromFile(wireMock, 'wiremock/mappings/oauth/client_credentials/token_request_error.json');
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyErrorWasThrown('Error while getting access token. Message: Request failed with status code 400');
  });

  //no token in response
  it('Successful flow scenario Client Credentials flow - no token', async function () {
    await addWireMockMappingsFromFile(wireMock, 'wiremock/mappings/oauth/client_credentials/token_request_error_no_token.json');
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyErrorWasThrown('Error while getting access token. Message: "response" body "access_token" property must be a string');
  });


  //no token in response
  it('Successful flow scenario with single use refresh token - no token', async function () {
    await addWireMockMappingsFromFile(wireMock, 'wiremock/mappings/oauth/client_credentials/successful_flow_with_single_use_refresh_tokens.json');
    const extendedConnectionOption = { ...connectionOption,
      ...{
        enableSingleUseRefreshTokens: true
      }
    };
    authTest.createConnection(extendedConnectionOption);
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
    await authTest.verifyConnectionIsUp();
  });

});
