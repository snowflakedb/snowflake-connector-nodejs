import assert from 'assert';
import sinon from 'sinon';
import { WireMockRestClient } from 'wiremock-rest-client';
import { WIP_ConnectionOptions } from '../../../lib/connection/types';
import * as testUtil from '../testUtil';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../../wiremockRunner';
import { rest } from '../../../lib/global_config';
import { getFreePort } from '../../../lib/util';

describe('External browser authenticator-request error', function () {
  let wiremock: WireMockRestClient;
  let connectionConfig: WIP_ConnectionOptions;

  // NOTE:
  // getSSOURL has unusual URL construction that doesn't match other API requests. We should refactor it
  // to avoid the "host" and HTTPS_PROTOCOL hacks below, but the Universal Driver will replace this code,
  // so it's not worth the effort now.
  before(async () => {
    const port = await getFreePort();
    wiremock = await runWireMockAsync(port);
    connectionConfig = {
      // A hackish option to include port in SSO url request
      host: `127.0.0.1:${port}`,
      authenticator: 'EXTERNALBROWSER',
    };
    // Forse SSO URL request to use wiremock http
    sinon.stub(rest, 'HTTPS_PROTOCOL').value('http');
  });

  after(async () => {
    await wiremock.global.shutdown();
    sinon.restore();
  });

  it('surfaces Snowflake error message in the connect callback', async function () {
    await addWireMockMappingsFromFile(
      wiremock,
      'wiremock/mappings/external_browser/authenticator_request_error.json',
    );
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
