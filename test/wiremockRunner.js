const WireMockRestClient =  require('wiremock-rest-client').WireMockRestClient;
const { exec } = require('child_process');
const Logger = require('../lib/logger');
const fs = require('fs');


async function runWireMockAsync(port) {
  let timeoutHandle;
  const waitingWireMockPromise =  new Promise( (resolve, reject) => {
    try {
      exec(`npx wiremock --enable-browser-proxying --proxy-pass-through  false --port ${port} `);
      const wireMock = new WireMockRestClient(`http://localhost:${port}`, { logLevel: 'debug' });
      const readyWireMock =  waitForWiremockStarted(wireMock);
      resolve(readyWireMock);
    } catch (err) {
      reject(err);
    }
  });

  const timeout = new Promise((resolve, reject) =>
    timeoutHandle = setTimeout(
      () => reject('Wiremock unavailable after 30s.'),
      30000));
  return Promise.race([waitingWireMockPromise, timeout])
    .then(result => {
      clearTimeout(timeoutHandle);
      return result;
    });
}

async function waitForWiremockStarted(wireMock) {
  let counter = 30;
  return fetch(wireMock.baseUri)
    .then(async (resp) => {
      if (resp.ok) {
        return Promise.resolve(wireMock);
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
        Logger.getInstance().info(`Retry connection to WireMock after wrong response status: ${resp.status}`);
        if (++counter < 30) { //stop after 30s
          return await waitForWiremockStarted(wireMock);
        } else {
          Promise.reject('Wiremock: Waiting time has expired');
        }
      }
    })
    .catch(async (err) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      Logger.getInstance().info(`Retry connection to WireMock after error: ${err}`);
      if (++counter < 30) { //stop after 30s
        return await waitForWiremockStarted(wireMock);
      } else {
        Promise.reject('Wiremock: Waiting time has expired');
      }
    });
}

async function addWireMockMappingsFromFile(wireMock, filePath) {
  const requests = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  for (const mapping of requests.mappings) {
    await wireMock.mappings.createMapping(mapping);
  }
}

exports.runWireMockAsync = runWireMockAsync;
exports.addWireMockMappingsFromFile = addWireMockMappingsFromFile;

