const WireMockRestClient = require('wiremock-rest-client').WireMockRestClient;
const { spawn } = require('child_process');
const Logger = require('../lib/logger');
const fs = require('fs');

async function runWireMockAsync(port) {
  let timeoutHandle;
  const counter = 0;
  let child;

  const waitingWireMockPromise = new Promise((resolve, reject) => {
    try {
      child = spawn(
        'npx',
        [
          'wiremock',
          '--enable-browser-proxying',
          '--proxy-pass-through',
          'false',
          '--port',
          String(port),
        ],
        {
          stdio: 'inherit',
          shell: true, // For Windows
        },
      );

      child.on('exit', () => {});
      const wireMock = new WireMockRestClient(`http://localhost:${port}`, { logLevel: 'debug' });
      waitForWiremockStarted(wireMock, counter).then(resolve).catch(reject);
    } catch (err) {
      reject(err);
    }
  });

  const timeout = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => reject('Wiremock unavailable after 30s.'), 30000);
  });

  return Promise.race([waitingWireMockPromise, timeout]).finally(() => {
    clearTimeout(timeoutHandle);
    child.kill();
  });
}

async function waitForWiremockStarted(wireMock, counter) {
  return fetch(wireMock.baseUri)
    .then(async (resp) => {
      if (resp.ok) {
        return Promise.resolve(wireMock);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        Logger.getInstance().info(
          `Retry connection to WireMock after wrong response status: ${resp.status}`,
        );
        if (++counter < 30) {
          //stop after 30s
          return await waitForWiremockStarted(wireMock, counter);
        } else {
          Promise.reject('Wiremock: Waiting time has expired');
        }
      }
    })
    .catch(async (err) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      Logger.getInstance().info(`Retry connection to WireMock after error: ${err}`);
      if (++counter < 30) {
        //stop after 30s
        return await waitForWiremockStarted(wireMock, counter);
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
