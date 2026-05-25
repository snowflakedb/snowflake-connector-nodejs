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

  async function runFlow(opts: {
    rendererBody: (result: { error?: string }) => string;
    redirectQueryString: string;
  }): Promise<{ connectError: Error | null; capturedResponse: any }> {
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
      browserResponseRenderer: opts.rendererBody,
      openExternalBrowserCallback: () => {
        const target = `http://127.0.0.1:${browserRedirectPort}/?${opts.redirectQueryString}`;
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
    return { connectError, capturedResponse };
  }

  it('writes the renderer output on the local callback server', async function () {
    const { connectError, capturedResponse } = await runFlow({
      rendererBody: ({ error }) =>
        error
          ? `<html><body><h1>BAD</h1><pre>${error}</pre></body></html>`
          : '<html><body><h1>BROWSER OK</h1></body></html>',
      redirectQueryString: 'token=fake-saml-token',
    });

    assert.strictEqual(connectError, null, `unexpected connect error: ${connectError?.message}`);
    assert.ok(capturedResponse, 'expected the browser callback to receive a response');
    assert.strictEqual(capturedResponse.status, 200);
    assert.match(capturedResponse.headers['content-type'], /text\/html; charset=utf-8/i);
    assert.ok(
      capturedResponse.data.includes('<h1>BROWSER OK</h1>'),
      `expected success body, got: ${capturedResponse.data}`,
    );
  });

  it('writes the renderer output on the callback error path', async function () {
    const { capturedResponse } = await runFlow({
      rendererBody: ({ error }) =>
        error
          ? `<html><body><h1>BAD</h1><pre>${error}</pre></body></html>`
          : '<html><body><h1>BROWSER OK</h1></body></html>',
      redirectQueryString: 'error=access_denied&error_description=user+declined',
    });

    // We intentionally do not assert on connectError here: on the error path,
    // AuthWeb's server rejects which surfaces as a connect failure. The
    // renderer behaviour is the subject of this test.
    assert.ok(capturedResponse, 'expected the browser callback to receive a response');
    assert.strictEqual(capturedResponse.status, 200);
    assert.match(capturedResponse.headers['content-type'], /text\/html; charset=utf-8/i);
    assert.ok(capturedResponse.data.includes('<h1>BAD</h1>'));
    assert.ok(capturedResponse.data.includes('access_denied'));
  });
});
