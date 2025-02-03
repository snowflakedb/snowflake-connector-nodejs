const WireMockRestClient =  require('wiremock-rest-client').WireMockRestClient;
const { exec } = require('child_process');
const Logger = require('../../../lib/logger');


async function runWireMockAsync(port) {
  let timeoutHandle;
  const waitingWireMockPromise =  new Promise(async (resolve, reject) => {
    try {
      exec(`npx wiremock --enable-browser-proxying --proxy-pass-through  false --port ${port} `);
      const wireMock = new WireMockRestClient(`http://localhost:${port}`);
      const readyWireMock = await waitForWiremockStarted(wireMock);
      resolve(readyWireMock);
    } catch (err) {
      reject(err);
    }
  });

  const timeout = new Promise((resolve, reject) =>
    timeoutHandle = setTimeout(
      () => reject('Wiremock unavailable  after 60s.'),
      60000));
  return Promise.race([waitingWireMockPromise, timeout])
    .then(result => {
      clearTimeout(timeoutHandle);
      return result;
    });
};

async function waitForWiremockStarted(wireMock) {
  return fetch(wireMock.baseUri)
    .then(async (resp) => {
      if (resp.ok) {
        return Promise.resolve(wireMock);
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
        Logger.getInstance().info(`Retry connection to WireMock after wrong response status: ${resp.status}`);
        return await waitForWiremockStarted(wireMock);
      }
    })
    .catch(async (err) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      Logger.getInstance().info(`Retry connection to WireMock after error: ${err}`);
      return await waitForWiremockStarted(wireMock);
    });
}

exports.runWireMockAsync = runWireMockAsync;

