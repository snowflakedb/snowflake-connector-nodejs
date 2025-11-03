const WireMockRestClient = require('wiremock-rest-client').WireMockRestClient;
const { spawn } = require('child_process');
const Logger = require('../lib/logger');
const fs = require('fs');

async function runWireMockAsync(port, options = {}) {
  let timeoutHandle;
  const counter = 0;
  let child;

  // Configurable timeout via environment variable (default 30s, 60s for slower environments like RHEL9)
  const startupTimeoutMs = parseInt(
    process.env.WIREMOCK_STARTUP_TIMEOUT_MS || '30000',
    10,
  );
  const maxRetries = Math.floor(startupTimeoutMs / 1000); // One retry per second

  const wiremockArgs = [
    'wiremock',
    '--enable-browser-proxying',
    '--proxy-pass-through',
    'false',
    '--port',
    String(port),
  ];

  const waitingWireMockPromise = new Promise((resolve, reject) => {
    try {
      // Wiremock npm package automatically picks up JAVA_OPTS from environment
      // JAVA_OPTS should be set in the environment (e.g., in Dockerfile) for JVM optimization
      const spawnEnv = { ...process.env };

      child = spawn('npx', wiremockArgs, {
        stdio: 'inherit',
        shell: true, // For Windows
        env: spawnEnv,
      });

      child.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          Logger.getInstance().warn(`Wiremock process exited with code ${code}`);
        }
      });

      child.on('error', (err) => {
        Logger.getInstance().error(`Failed to start Wiremock: ${err.message}`);
        reject(err);
      });

      const wireMock = new WireMockRestClient(`http://localhost:${port}`, {
        logLevel: 'debug',
        ...options,
      });
      waitForWiremockStarted(wireMock, counter, maxRetries)
        .then(resolve)
        .catch(reject);
    } catch (err) {
      reject(err);
    }
  });

  const timeout = new Promise((_, reject) => {
    timeoutHandle = setTimeout(
      () =>
        reject(
          `Wiremock unavailable after ${startupTimeoutMs / 1000}s. Consider increasing WIREMOCK_STARTUP_TIMEOUT_MS environment variable.`,
        ),
      startupTimeoutMs,
    );
  });

  return Promise.race([waitingWireMockPromise, timeout]).finally(() => {
    clearTimeout(timeoutHandle);
    if (child) {
      child.kill();
    }
  });
}

async function waitForWiremockStarted(wireMock, counter, maxRetries = 30) {
  return fetch(wireMock.baseUri)
    .then(async (resp) => {
      if (resp.ok) {
        Logger.getInstance().info(
          `Wiremock is ready at ${wireMock.baseUri} (after ${counter} retries)`,
        );
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
