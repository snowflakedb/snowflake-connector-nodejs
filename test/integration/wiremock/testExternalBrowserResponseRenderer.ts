import assert from 'assert';
import sinon from 'sinon';
import { WireMockRestClient } from 'wiremock-rest-client';
import * as testUtil from '../testUtil';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../../wiremockRunner';
import { rest } from '../../../lib/global_config';
import { getFreePort } from '../../../lib/util';

// Use CommonJS require for axios and authentication_util to avoid forcing this
// file into ESM resolution (axios is "type": "module") which would break the
// relative imports above under ts-node's CJS mode.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { get } = require('axios');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const authUtil = require('../../../lib/authentication/authentication_util');

describe('External browser browserResponseRenderer', function () {
  let wiremock: WireMockRestClient;
  let wiremockPort: number;

  before(async () => {
    wiremockPort = await getFreePort();
    wiremock = await runWireMockAsync(wiremockPort);
    // SSO URL provider uses rest.HTTPS_PROTOCOL to build the request URL;
    // point it at http so wiremock can serve the response.
    sinon.stub(rest, 'HTTPS_PROTOCOL').value('http');
  });

  after(async () => {
    await wiremock.global.shutdown();
    sinon.restore();
  });

  afterEach(async () => {
    await wiremock.scenarios.resetAllScenarios();
    await wiremock.mappings.resetAllMappings();
  });

  it('writes the renderer output on the local callback server', async function () {
    await addWireMockMappingsFromFile(
      wiremock,
      'wiremock/mappings/external_browser/successful_flow.json',
    );

    // Pin the local callback port so the test knows where to send the SAML
    // redirect. AuthWeb opens an SSO URL in the browser (we intercept); the
    // real IdP would then redirect the browser to http://localhost:<port>/?token=...
    const browserRedirectPort = await getFreePort();
    let capturedResponse: any;
    let callbackComplete: Promise<void>;

    const connection = testUtil.createConnection({
      accessUrl: `http://127.0.0.1:${wiremockPort}`,
      host: `127.0.0.1:${wiremockPort}`,
      account: 'MOCK_ACCOUNT_NAME',
      username: 'MOCK_USERNAME',
      authenticator: 'EXTERNALBROWSER',
      browserRedirectPort,
      browserResponseRenderer: () => '<html><body><h1>BROWSER OK</h1></body></html>',
      openExternalBrowserCallback: () => {
        const target = `http://127.0.0.1:${browserRedirectPort}/?token=fake-saml-token`;
        callbackComplete = authUtil
          .withBrowserActionTimeout(3000, get(target))
          .then((res: any) => {
            capturedResponse = res;
          })
          // Swallow axios errors (e.g. ECONNRESET) - we only care about whether
          // the renderer body landed before the socket was destroyed.
          .catch(() => {});
      },
    });

    let connectError: Error | null = null;
    try {
      await testUtil.connectAsync(connection);
    } catch (err) {
      connectError = err as Error;
    }
    // Make sure the in-flight axios call settles so capturedResponse is observed.
    await callbackComplete!;

    assert.strictEqual(connectError, null, `unexpected connect error: ${connectError?.message}`);
    assert.ok(capturedResponse, 'expected the browser callback to receive a response');
    assert.strictEqual(capturedResponse.status, 200);
    assert.match(capturedResponse.headers['content-type'], /text\/html; charset=utf-8/i);
    assert.ok(
      capturedResponse.data.includes('<h1>BROWSER OK</h1>'),
      `expected success body, got: ${capturedResponse.data}`,
    );
  });
});
