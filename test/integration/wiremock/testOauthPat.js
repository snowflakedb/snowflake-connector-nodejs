const assert = require('assert');
const fs = require('fs');
const net = require('net');
const connParameters = require('../../authentication/connectionParameters');
const axios = require('axios');
const AuthTest = require('../../authentication/authTestsBaseClass');
const { runWireMockAsync } = require('../../wiremockRunner');
const os = require('os');

async function getPortFree() {
  return new Promise(res => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => res(port));
    });
  });
}

if (os.platform !== 'win32')  {
  describe('Oauth PAT authentication', function () {
    let port;
    let authTest;
    let wireMock;
    before(async () => {
      port = await getPortFree();
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
      await addWireMockMappingsFromFile('wiremock/mappings/pat/successful_flow.json');
      const connectionOption = { ...connParameters.oauthPATOnWiremock, token: 'MOCK_TOKEN', port: port };
      authTest.createConnection(connectionOption);
      await authTest.connectAsync();
      authTest.verifyNoErrorWasThrown();
    });

    it('Successful flow scenario PAT as password', async function () {
      await addWireMockMappingsFromFile('wiremock/mappings/pat/successful_flow.json');
      const connectionOption = { ...connParameters.oauthPATOnWiremock, password: 'MOCK_TOKEN', port: port };
      authTest.createConnection(connectionOption);
      await authTest.connectAsync();
      authTest.verifyNoErrorWasThrown();
    });

    it('Invalid token', async function () {
      await addWireMockMappingsFromFile('wiremock/mappings/pat/invalid_pat_token.json');
      const connectionOption = { ...connParameters.oauthPATOnWiremock, token: 'INVALID_TOKEN', port: port };
      authTest.createConnection(connectionOption);
      await authTest.connectAsync();
      authTest.verifyErrorWasThrown('Programmatic access token is invalid.');
    });

    async function addWireMockMappingsFromFile(filePath) {
      const requests = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      for (const mapping of requests.mappings) {
        await wireMock.mappings.createMapping(mapping);
      }
    }
  });
}
