import assert from 'assert';
import sinon from 'sinon';
import { WireMockRestClient } from 'wiremock-rest-client';
import { WIP_ConnectionOptions } from '../../../lib/connection/types';
import * as testUtil from '../testUtil';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../../wiremockRunner';
import { rest } from '../../../lib/global_config';
import { getFreePort } from '../../../lib/util';
import authUtil from '../../../lib/authentication/authentication_util';

describe('External browser authentication', function () {
  let wiremock: WireMockRestClient;
  let wiremockPort: number;

  // NOTE:
  // getSSOURL has unusual URL construction that doesn't match other API requests. We should refactor it
  // to avoid the "host" and HTTPS_PROTOCOL hacks below, but the Universal Driver will replace this code,
  // so it's not worth the effort now.
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

  it('successfully logs in with custom browserResponseRenderer', async function () {
    await addWireMockMappingsFromFile(
      wiremock,
      'wiremock/mappings/external_browser/authenticator_request_ok.json',
    );
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/login_request_ok.json');

    const browserRedirectPort = await getFreePort();
    let capturedResponse: string;
    let callbackComplete: Promise<void>;

    const connection = testUtil.createConnection({
      accessUrl: `http://127.0.0.1:${wiremockPort}`,
      host: `127.0.0.1:${wiremockPort}`,
      authenticator: 'EXTERNALBROWSER',
      browserRedirectPort,
      browserResponseRenderer: () => 'BROWSER OK',
      openExternalBrowserCallback: () => {
        const target = `http://127.0.0.1:${browserRedirectPort}/?token=fake-saml-token`;
        callbackComplete = authUtil.withBrowserActionTimeout(
          3000,
          fetch(target).then(async (res) => {
            capturedResponse = await res.text();
          }),
        );
      },
    });

    await testUtil.connectAsync(connection);
    await callbackComplete!;
    assert.strictEqual(connection.isUp(), true);
    assert.match(capturedResponse!, /BROWSER OK/);
  });

  it('surfaces Snowflake error message in the connect callback', async function () {
    await addWireMockMappingsFromFile(
      wiremock,
      'wiremock/mappings/external_browser/authenticator_request_error.json',
    );
    const connectionConfig: WIP_ConnectionOptions = {
      // A hackish option to include port in SSO url request
      host: `127.0.0.1:${wiremockPort}`,
      authenticator: 'EXTERNALBROWSER',
    };
    const connection = testUtil.createConnection(connectionConfig);
    await assert.rejects(
      () => testUtil.connectAsync(connection),
      (err: Error) => {
        assert.match(
          err.message,
          /Error code: 390511, message: SSO URL generation failed in External browser's SAML Request flow/,
        );
        return true;
      },
    );
  });
});
