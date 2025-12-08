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
          '--verbose',
          'false',
          '--port',
          String(port),
          ...(options.wiremockJarArgs || []),
        ],
        {
          stdio: 'inherit',
          shell: true, // For Windows
        },
      );

      child.on('exit', () => {});
      // Use 127.0.0.1 instead of localhost to avoid IPv6/IPv4 resolution issues on Node.js 18 + RHEL9
      const baseUri = `http://127.0.0.1:${port}`;
      const wireMock = new WireMockRestClient(baseUri, {
        logLevel: 'debug',
        ...options,
      });
      waitForWiremockStarted(wireMock, counter, maxRetries)
        .then((restClient) => {
          restClient.rootUrl = baseUri;
          resolve(restClient);
        })
        .catch(reject);
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

/**
 * Adds WireMock mappings from a JSON file with support for template variable replacement.
 *
 * Template variables in the file can be specified using double curly braces with optional spaces:
 * - {{variable1}} - no spaces around variable name
 * - {{ variable1 }} - spaces around variable name
 *
 * @param {Object} wireMock - The WireMock REST client instance
 * @param {string} filePath - Path to the JSON file containing WireMock mappings
 * @param {Object} [options={}] - Options object
 * @param {Object} [options.replaceVariables={}] - Object containing key-value pairs for template variable replacement
 * @param {boolean} [options.sendRaw=false] - Allows to send the wiremock contents as is to bypass JSON validation
 */
async function addWireMockMappingsFromFile(wireMock, filePath, options = {}) {
  const { replaceVariables = {}, sendRaw = false } = options;
  const fileContent = fs
    .readFileSync(filePath, 'utf8')
    .replace(/\\/g, '\\\\') // Escape backslashes in the file content for JSON compatibility on Windows
    .replaceAll(/\{\{\s*([^}]+)\s*\}\}/g, (match, variableName) => {
      const trimmedVariableName = variableName.trim();
      if (replaceVariables[trimmedVariableName]) {
        return replaceVariables[trimmedVariableName];
      }
      // If variable is not found, leave the placeholder unchanged
      return match;
    });

  console.log('fileContent after replacement---------------->', fileContent);
  console.log('JSON', JSON.parse(fileContent));

  if (sendRaw) {
    const result = await fetch(`${wireMock.rootUrl}/__admin/mappings/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: fileContent,
    });
    if (!result.ok) {
      throw new Error(`Failed to add WireMock mappings: ${result}. Content: ${fileContent}`);
    }
  } else {
    const requests = JSON.parse(fileContent);
    for (const mapping of requests.mappings) {
      await wireMock.mappings.createMapping(mapping);
    }
  }
}

exports.runWireMockAsync = runWireMockAsync;
exports.addWireMockMappingsFromFile = addWireMockMappingsFromFile;
