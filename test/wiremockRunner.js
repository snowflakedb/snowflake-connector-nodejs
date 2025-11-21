const WireMockRestClient = require('wiremock-rest-client').WireMockRestClient;
const { spawn } = require('child_process');
const Logger = require('../lib/logger');
const fs = require('fs');

async function runWireMockAsync(port, options = {}) {
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
      const wireMock = new WireMockRestClient(`http://localhost:${port}`, {
        logLevel: 'debug',
        ...options,
      });
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

/**
 * Adds WireMock mappings from a JSON file with support for template variable replacement.
 *
 * Template variables in the file can be specified using double curly braces with optional spaces:
 * - {{variable1}} - no spaces around variable name
 * - {{ variable1 }} - spaces around variable name
 *
 * @param {Object} wireMock - The WireMock REST client instance
 * @param {string} filePath - Path to the JSON file containing WireMock mappings
 * @param {Object} [fileVariables={}] - Object containing key-value pairs for template variable replacement
 */
async function addWireMockMappingsFromFile(wireMock, filePath, fileVariables = {}) {
  let fileContent = fs.readFileSync(filePath, 'utf8');

  // Replace template variables in the file content
  // Regex matches {{variable}} or {{ variable }} with optional whitespace
  fileContent = fileContent.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, variableName) => {
    const trimmedVariableName = variableName.trim();
    if (fileVariables[trimmedVariableName]) {
      return fileVariables[trimmedVariableName];
    }
    // If variable is not found, leave the placeholder unchanged
    return match;
  });

  const requests = JSON.parse(fileContent);
  for (const mapping of requests.mappings) {
    await wireMock.mappings.createMapping(mapping);
  }
}

exports.runWireMockAsync = runWireMockAsync;
exports.addWireMockMappingsFromFile = addWireMockMappingsFromFile;
