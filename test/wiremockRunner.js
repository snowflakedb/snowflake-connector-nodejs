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
          '--async-response-enabled',
          'true',
          '--proxy-pass-through',
          'false',
          '--port',
          String(port),
          ...(options.wiremockJarArgs || []),
        ],
        {
          stdio: 'inherit',
          shell: true, // For Windows
          detached: true,
        },
      );
      child.unref();
      const baseUri = `http://localhost:${port}`;
      const wireMock = new WireMockRestClient(baseUri, {
        logLevel: 'debug',
        ...options,
      });
      waitForWiremockStarted(wireMock, counter, maxRetries)
        .then((restClient) => {
          restClient.rootUrl = baseUri;
          resolve(patchAdminClientWithNativeFetch(restClient, baseUri));
        })
        .catch(reject);
    } catch (err) {
      reject(err);
    }
  });

  const timeout = new Promise((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(`Wiremock unavailable after ${startupTimeoutMs / 1000}s.`);
    }, startupTimeoutMs);
  });

  return Promise.race([waitingWireMockPromise, timeout]).finally(() => {
    clearTimeout(timeoutHandle);
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
 * @param {string} baseUri - WireMock base URI, e.g. http://localhost:8081
 * @param {string} path - Admin path beginning with `/`, e.g. `/__admin/shutdown`
 * @param {Object} [options={}] - Fetch options (method, body, ...)
 * @returns {Promise<any>} Parsed JSON body when present, otherwise the raw text.
 */
async function adminFetch(baseUri, path, options = {}) {
  const response = await fetch(`${baseUri}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`WireMock admin request failed: [${response.status}] ${path} - ${text}`);
  }
  try {
    return text ? JSON.parse(text) : text;
  } catch {
    return text;
  }
}

/**
 * Replaces the `wiremock-rest-client` admin methods that our tests use with native-`fetch`
 * implementations (see {@link adminFetch}). All existing call sites keep working unchanged - only
 * the transport underneath changes.
 *
 * WHY THIS PATCH EXISTS:
 * `wiremock-rest-client` routes every admin call through `cross-fetch`, which on the server side
 * pulls in the unmaintained `node-fetch@2`. Node's June 2026 security release (CVE-2026-48931 - the
 * HTTP "response queue poisoning" fix, shipped in 22.23.0 / 24.17.0 / 26.3.1) added a guard
 * listener on idle keep-alive sockets. That guard makes `node-fetch@2` mis-detect a perfectly
 * complete response as truncated and throw `FetchError: ... Premature close`
 * (nodejs/node#63989, #64098). WireMock's admin server closes its keep-alive socket aggressively -
 * especially on `/__admin/shutdown` - so as soon as the GitHub Actions runners picked up those Node
 * patches, the rest-client started crashing our WireMock tests in setup/teardown hooks.
 *
 * Node's native `fetch` (undici) does NOT have this bug, so we re-point each admin method the tests
 * rely on at `adminFetch`, which talks to WireMock directly. Keeping the workaround here (rather
 * than pinning a CI Node version) makes it independent of the runtime and resilient to future
 * re-regressions of the same kind (it already re-regressed once on the 26.x line).
 *
 * TODO: Drop wiremock-rest-client in the Universal Driver migration
 *
 * @param {Object} restClient - The WireMock REST client instance
 * @param {string} baseUri - WireMock base URI
 * @returns {Object} The same client, with admin methods patched.
 */
function patchAdminClientWithNativeFetch(restClient, baseUri) {
  // Shutdown is pure teardown: the server is going away, so a dropped connection while it tears
  // down its socket is expected and harmless. Swallow connection errors so cleanup never fails the
  // suite (an unreachable server here just means it already stopped).
  restClient.global.shutdown = async () => {
    try {
      return await adminFetch(baseUri, '/__admin/shutdown', { method: 'POST' });
    } catch (err) {
      Logger.getInstance().info(`Ignoring WireMock shutdown error: ${err.message || err}`);
      return '';
    }
  };

  restClient.mappings.resetAllMappings = () =>
    adminFetch(baseUri, '/__admin/mappings/reset', { method: 'POST' });

  restClient.mappings.createMapping = (stubMapping) =>
    adminFetch(baseUri, '/__admin/mappings', {
      method: 'POST',
      body: JSON.stringify(stubMapping),
    });

  restClient.scenarios.resetAllScenarios = () =>
    adminFetch(baseUri, '/__admin/scenarios/reset', { method: 'POST' });

  restClient.requests.getCount = (requestPattern) =>
    adminFetch(baseUri, '/__admin/requests/count', {
      method: 'POST',
      body: JSON.stringify(requestPattern),
    });

  return restClient;
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
    .replaceAll(/\{\{\s*([^}]+)\s*\}\}/g, (match, variableName) => {
      const replacedValue = replaceVariables[variableName.trim()];
      if (replacedValue) {
        // Escape backslashes for JSON parsing (e.g., Windows paths like C:\Users\test)
        return typeof replacedValue === 'string'
          ? replacedValue.replaceAll('\\', '\\\\')
          : replacedValue;
      } else {
        // If variable is not found, leave the placeholder unchanged
        return match;
      }
    });

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
