const WireMockRestClient = require('wiremock-rest-client').WireMockRestClient;
const { spawn } = require('child_process');
const fs = require('fs');
const { dirname, join } = require('path');
const { setTimeout: delay } = require('timers/promises');
const { getFreePort } = require('../lib/util');

async function runWireMockAsync(port, options = {}) {
  port ??= await getFreePort();
  const { enableBrowserProxying = true, wiremockJarArgs = [], ...clientOptions } = options;
  const build = join(dirname(require.resolve('wiremock/package.json')), 'build');
  const jar = fs.readdirSync(build).find((name) => /^wiremock-standalone-.*\.jar$/.test(name));
  if (!jar) throw new Error('Install the wiremock dev dependency');
  const rootUrl = `http://localhost:${port}`;
  const wireMock = new WireMockRestClient(rootUrl, { logLevel: 'debug', ...clientOptions });
  // Own the JVM directly, including on Windows; no shell or detached npx descendants.
  const child = spawn(
    'java',
    [
      '-jar',
      join(build, jar),
      ...(enableBrowserProxying ? ['--enable-browser-proxying'] : []),
      '--async-response-enabled',
      'true',
      '--proxy-pass-through',
      'false',
      '--port',
      String(port),
      ...wiremockJarArgs,
    ],
    { stdio: 'inherit' },
  );
  let launchError;
  child.on('error', (error) => {
    launchError = error;
  });
  const exited = new Promise((resolve) => child.once('close', resolve));
  // Emergency cleanup is separate from the existing graceful global.shutdown() API.
  async function stop() {
    let timer;
    try {
      if (child.pid && child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      await Promise.race([
        exited,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('WireMock did not stop within 2s')), 2000);
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  // RHEL9 and Windows sometimes take longer than 30s to start.
  const deadline = Date.now() + 60000;
  try {
    while (Date.now() < deadline) {
      if (launchError) throw launchError;
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(`WireMock exited before startup: ${child.exitCode ?? child.signalCode}`);
      }
      const healthy = await fetch(`${rootUrl}/__admin/health`, {
        signal: AbortSignal.timeout(Math.max(1, Math.min(1000, deadline - Date.now()))),
      }).then(
        async (response) => {
          await response.body?.cancel();
          return response.ok;
        },
        () => false,
      );
      if (healthy) return Object.assign(wireMock, { rootUrl, stop });
      await delay(100);
    }
    throw new Error('WireMock unavailable after 60s');
  } catch (error) {
    await stop();
    throw error;
  }
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
