const assert = require('assert');
const fs = require('fs');
const net = require('net');
const connParameters = require('../authentication/connectionParameters');
const axios = require('axios');
const { snowflakeAuthTestOauthClientId,
  snowflakeAuthTestOauthClientSecret, snowflakeAuthTestOauthUrl
} = require('../authentication/connectionParameters');
const AuthTest = require('../authentication/authTestsBaseClass');
const WireMockRestClient =  require('wiremock-rest-client').WireMockRestClient;
const { exec } = require('child_process');



async function runWireMockAsync(port) {
  let timeoutHandle;
  const waitingWireMockPromise =  new Promise(async (resolve, reject) => {
    try {
      exec(`npx wiremock --enable-browser-proxying --proxy-pass-through  false --port ${port} `, (error, stdout, stderr) => {
        if (error) {
          console.error(`exec error: ${error}`);
          return;
        }
        console.log(`stdout: ${stdout}`);
        console.error(`stderr: ${stderr}`);
      });
      const wireMock = new WireMockRestClient(`http://localhost:${port}`);
      const readyWireMock = await waitForWiremockStarted(wireMock);
      resolve(readyWireMock);
    } catch (err) {
      reject(err);
    }
  });


  const timeout = new Promise((resolve, reject) =>
    timeoutHandle = setTimeout(
      () => reject('Wiremock unavailable  after 60000 ms.'),
      60000));
  return Promise.race([waitingWireMockPromise, timeout])
    .then(result => {
      clearTimeout(timeoutHandle);
      return result;
    });
}

async function waitForWiremockStarted(wireMock) {
  return fetch(wireMock.baseUri)
    .then(async (resp) => {
      if (resp.ok) {
        return Promise.resolve(wireMock);
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`Retry connection to WireMock after wrong response status: ${resp.status}`);
        return await waitForWiremockStarted(wireMock);
      }
    })
    .catch(async (err) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`Retry connection to WireMock after error: ${err}`);
      return await waitForWiremockStarted(wireMock);
    });
}

describe('Wiremock test', function () {
  let port, wireMock;
  before(async () => {
    port = await getPortFree();
    wireMock = await runWireMockAsync(port);
  });
  after(async () => {
    await wireMock.global.shutdown();
  });
  it('Run Wiremock instance, wait, verify connection and shutdown', async function () {
    assert.doesNotReject(async () => await wireMock.mappings.getAllMappings());
  });
  it('Add mappings', async function () {
    const requests = JSON.parse(fs.readFileSync('wiremock/mappings/test.json', 'utf8'));
    for (const mapping of  requests.mappings) {
      await wireMock.mappings.createMapping(mapping);
    }
    const mappings = await wireMock.mappings.getAllMappings();
    assert.strictEqual(mappings.mappings.length, 2);
    const response = await axios.get(`http://localhost:${port}/test/authorize.html`);
    assert.strictEqual(response.status, 200);
  });
});

describe('Oauth authentication', function () {
  let authTest;

  beforeEach(async () => {
    authTest = new AuthTest();
  });

  afterEach(async () => {
    await authTest.destroyConnection();
  });

  it('Successful connection', async function () {
    const token = await getToken();
    const connectionOption = { ...connParameters.oauth, token: token };
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyNoErrorWasThrown();
    await authTest.verifyConnectionIsUp();
  });

  it('Invalid token', async function () {
    const connectionOption = { ...connParameters.oauth, token: 'invalidToken' };
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyErrorWasThrown('Invalid OAuth access token. ');
    await authTest.verifyConnectionIsNotUp('Unable to perform operation using terminated connection.');
  });

  it('Mismatched username', async function () {
    const token = await getToken();
    const connectionOption = { ...connParameters.oauth, username: 'itsnotanaccount.com', token: token };
    authTest.createConnection(connectionOption);
    await authTest.connectAsync();
    authTest.verifyErrorWasThrown('The user you were trying to authenticate as differs from the user tied to the access token.');
    await authTest.verifyConnectionIsNotUp('Unable to perform operation using terminated connection.');
  });
});

describe.only('Oauth PAT authentication', function () {
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
    const connectionOption = { ...connParameters.oauthPATOnWiremock, token: 'INVALID_TOKEN', port: port  };
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

async function getToken() {
  const response =  await axios.post(snowflakeAuthTestOauthUrl, {}, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    },
    auth: {
      username: snowflakeAuthTestOauthClientId,
      password: snowflakeAuthTestOauthClientSecret
    }
  });
  assert.strictEqual(response.status, 200, 'Failed to get access token');
  return response.data.access_token;
}

async function getPortFree() {
  return new Promise( res => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close((err) => res(port));
    });
  });
}
