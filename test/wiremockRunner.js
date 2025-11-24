const WireMockRestClient = require('wiremock-rest-client').WireMockRestClient;
const { spawn } = require('child_process');
const Logger = require('../lib/logger');
const fs = require('fs');

async function runWireMockAsync(port, options = {}) {
  let timeoutHandle;
  const counter = 0;
  let child;

  // Use environment variable for timeout (default 30s, can be increased for slower environments like RHEL9)
  const startupTimeoutMs = parseInt(process.env.WIREMOCK_STARTUP_TIMEOUT_MS || '30000', 10);
  const maxRetries = Math.floor(startupTimeoutMs / 1000);

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
      // Use 127.0.0.1 instead of localhost to avoid IPv6/IPv4 resolution issues on Node.js 18 + RHEL9
      const wireMock = new WireMockRestClient(`http://127.0.0.1:${port}`, {
        logLevel: 'debug',
        ...options,
      });
      waitForWiremockStarted(wireMock, counter, maxRetries).then(resolve).catch(reject);
    } catch (err) {
      reject(err);
    }
  });

  const timeout = new Promise((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(`Wiremock unavailable after ${startupTimeoutMs / 1000}s.`),
      startupTimeoutMs,
    );
  });

  return Promise.race([waitingWireMockPromise, timeout]).finally(() => {
    clearTimeout(timeoutHandle);
    child.kill();
  });
}

async function waitForWiremockStarted(wireMock, counter, maxRetries = 30) {
  return fetch(wireMock.baseUri)
    .then(async (resp) => {
      if (resp.ok) {
        return Promise.resolve(wireMock);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        Logger.getInstance().info(
          `Retry connection to WireMock after wrong response status: ${resp.status} (attempt ${counter + 1}/${maxRetries})`,
        );
        if (++counter < maxRetries) {
          return await waitForWiremockStarted(wireMock, counter, maxRetries);
        } else {
          return Promise.reject('Wiremock: Waiting time has expired');
        }
      }
    })
    .catch(async (err) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      Logger.getInstance().info(
        `Retry connection to WireMock after error: ${err.message || err} (attempt ${counter + 1}/${maxRetries})`,
      );
      if (++counter < maxRetries) {
        return await waitForWiremockStarted(wireMock, counter, maxRetries);
      } else {
        return Promise.reject('Wiremock: Waiting time has expired');
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
