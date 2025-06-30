const connParameters = require('../../authentication/connectionParameters');
const AuthTest = require('../../authentication/authTestsBaseClass');
const { runWireMockAsync, addWireMockMappingsFromFile } = require('../../wiremockRunner');
const os = require('os');
const { getFreePort } = require('../../../lib/util');

if (os.platform !== 'win32')  {
  describe('Oauth PAT authentication', function () {
    let port;
    let authTest;
    let wireMock;
    before(async () => {
      port = await getFreePort();
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

    it('Successful flow scenario PAT as token', async function () {
      await addWireMockMappingsFromFile(wireMock, 'wiremock/mappings/pat/successful_flow.json');
      const connectionOption = { ...connParameters.oauthPATOnWiremock, token: 'MOCK_TOKEN', port: port };
      authTest.createConnection(connectionOption);
      await authTest.connectAsync();
      authTest.verifyNoErrorWasThrown();
    });

    it('Successful flow scenario PAT as password', async function () {
      await addWireMockMappingsFromFile(wireMock, 'wiremock/mappings/pat/successful_flow.json');
      const connectionOption = { ...connParameters.oauthPATOnWiremock, password: 'MOCK_TOKEN', port: port };
      authTest.createConnection(connectionOption);
      await authTest.connectAsync();
      authTest.verifyNoErrorWasThrown();
    });

    it('Invalid token', async function () {
      await addWireMockMappingsFromFile(wireMock, 'wiremock/mappings/pat/invalid_pat_token.json');
      const connectionOption = { ...connParameters.oauthPATOnWiremock, token: 'INVALID_TOKEN', port: port };
      authTest.createConnection(connectionOption);
      await authTest.connectAsync();
      authTest.verifyErrorWasThrown('Programmatic access token is invalid.');
    });
  });
}
