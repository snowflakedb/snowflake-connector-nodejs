const WireMockRestClient = require('wiremock-rest-client').WireMockRestClient;
const { spawn } = require('child_process');
const Logger = require('../lib/logger').default;
const fs = require('fs');

async function runWireMockAsync(port, options = {}) {
  let child;
  const startupTimeoutMs = parseInt(
    process.env.WIREMOCK_STARTUP_TIMEOUT_MS || '30000',
    10,
  );
  const maxRetries = Math.floor(startupTimeoutMs / 1000);

  const wiremockArgs = [
    'wiremock',
    '--enable-browser-proxying',
    '--proxy-pass-through',
    'false',
    '--port',
    String(port),
  ];

  const waitingWireMockPromise = new Promise((resolve, reject) => {
    let stderrOutput = '';

    child = spawn('npx', wiremockArgs, {
      stdio: ['inherit', 'inherit', 'pipe'],
      shell: true,
    });

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderrOutput += data.toString();
      });
    }

    child.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        reject(
          new Error(
            `Wiremock process exited with code ${code}${signal ? ` (signal: ${signal})` : ''}. ${stderrOutput.slice(-200)}`,
          ),
        );
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to start Wiremock: ${err.message}`));
    });

    const wireMock = new WireMockRestClient(`http://localhost:${port}`, {
      logLevel: 'debug',
      ...options,
    });

    waitForWiremockStarted(wireMock, 0, maxRetries)
      .then(resolve)
      .catch(reject);
  });

  const timeout = new Promise((_, reject) => {
    setTimeout(
      () =>
        reject(
          new Error(
            `Wiremock unavailable after ${startupTimeoutMs / 1000}s. Consider increasing WIREMOCK_STARTUP_TIMEOUT_MS.`,
          ),
        ),
      startupTimeoutMs,
    );
  });

  return Promise.race([waitingWireMockPromise, timeout]).finally(() => {
    if (child) {
      child.kill();
    }
  });
}

async function waitForWiremockStarted(wireMock, counter, maxRetries = 30) {
  for (let attempt = counter; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const resp = await fetch(wireMock.baseUri, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (resp.ok) {
          Logger().info(`Wiremock ready at ${wireMock.baseUri} (after ${attempt} retries)`);
          return wireMock;
        }

        // Non-200 response - wait and retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
        Logger().info(`Retry after status ${resp.status} (attempt ${attempt + 1}/${maxRetries})`);
      } catch (fetchErr) {
        clearTimeout(timeoutId);
        // Connection error - wait and retry
        await new Promise((resolve) => setTimeout(resolve, 1000));
        Logger().info(`Retry after error: ${fetchErr.message} (attempt ${attempt + 1}/${maxRetries})`);

        if (attempt === maxRetries - 1) {
          throw new Error('Wiremock: Waiting time has expired');
        }
      }
    } catch (err) {
      if (attempt === maxRetries - 1) {
        throw err;
      }
    }
  }

  throw new Error('Wiremock: Waiting time has expired');
}

async function addWireMockMappingsFromFile(wireMock, filePath) {
  const requests = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  for (const mapping of requests.mappings) {
    await wireMock.mappings.createMapping(mapping);
  }
}

exports.runWireMockAsync = runWireMockAsync;
exports.addWireMockMappingsFromFile = addWireMockMappingsFromFile;
