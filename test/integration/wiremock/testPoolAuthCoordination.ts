import assert from 'assert';
import { WireMockRestClient } from 'wiremock-rest-client';
import * as testUtil from '../testUtil';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../../wiremockRunner';
import axios from 'axios';
import { PENDING_AUTHS } from '../../../lib/authentication/auth_coordinator';
import { withBrowserActionTimeout } from '../../../lib/authentication/authentication_util';
import { WIP_ConnectionOptions } from '../../../lib/connection/types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const snowflake = require('../../../lib/snowflake').default;

async function createConnectionsUsingPool(connectionOptions: WIP_ConnectionOptions) {
  const poolSize = 3;
  const pool = snowflake.createPool(connectionOptions, {
    max: poolSize,
    min: 0,
  });

  const connections: any[] = [];
  const acquirePromises = [];
  for (let i = 0; i < poolSize; i++) {
    acquirePromises.push(
      pool.acquire().then((conn: any) => {
        connections.push(conn);
        return conn;
      }),
    );
  }

  await Promise.all(acquirePromises);
  assert.strictEqual(
    connections.length,
    poolSize,
    `expected ${poolSize} connections but got ${connections.length}`,
  );

  for (const conn of connections) {
    await pool.release(conn);
  }
  await pool.drain();
  await pool.clear();
}

describe('Pool auth coordination', function () {
  let wiremock: WireMockRestClient;
  let port: number;

  before(async function () {
    port = await testUtil.getFreePort();
    wiremock = await runWireMockAsync(port);
  });

  afterEach(async function () {
    PENDING_AUTHS.clear();
    await wiremock.mappings.resetAllMappings();
  });

  after(async function () {
    await wiremock.global.shutdown();
  });

  describe('EXTERNALBROWSER', function () {
    function simulateExternalBrowserRedirect(loginUrl: string) {
      const url = new URL(loginUrl);
      const token = url.searchParams.get('proof_key') || 'mock-token';
      const callbackPort = url.searchParams.get('browser_mode_redirect_port');
      return axios.get(`http://127.0.0.1:${callbackPort}/?token=${token}`).catch(() => {});
    }

    it('opens browser only once for pooled connections', async function () {
      await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/login_request_ok.json');

      let browserOpenCount = 0;

      const connectionOptions = {
        accessUrl: `http://127.0.0.1:${port}`,
        authenticator: 'EXTERNALBROWSER',
        disableConsoleLogin: false,
        openExternalBrowserCallback: (loginUrl: string) => {
          browserOpenCount++;
          return simulateExternalBrowserRedirect(loginUrl);
        },
      };

      await createConnectionsUsingPool(connectionOptions);

      assert.strictEqual(
        browserOpenCount,
        1,
        `expected 1 browser open but got ${browserOpenCount}`,
      );
    });
  });

  describe('OAUTH_AUTHORIZATION_CODE', function () {
    function simulateOauthBrowserRedirect(urlString: string) {
      const redirectUri = new URL(urlString);
      const url = `${redirectUri.searchParams.get('redirect_uri')}?code=9s6wFkGDOjmgNEdwJMlDzv1AwxDjDVBxiT6wVqXjG5s&state=${redirectUri.searchParams.get('state')}`;
      return withBrowserActionTimeout(3000, axios.get(url));
    }

    it('opens browser only once for pooled connections', async function () {
      await addWireMockMappingsFromFile(
        wiremock,
        'wiremock/mappings/oauth/authorization_code/successful_flow.json',
      );

      let browserOpenCount = 0;

      const connectionOptions = {
        accessUrl: `http://127.0.0.1:${port}`,
        account: 'MOCK_ACCOUNT_NAME',
        username: 'MOCK_USERNAME',
        role: 'ANALYST',
        authenticator: 'OAUTH_AUTHORIZATION_CODE',
        oauthClientId: '123',
        oauthClientSecret: 'clientSecret',
        oauthAuthorizationUrl: `https://127.0.0.1:${port}/oauth/authorize`,
        oauthTokenRequestUrl: `http://127.0.0.1:${port}/oauth/token-request`,
        oauthRedirectUri: 'http://localhost:8009/snowflake/oauth-redirect',
        oauthHttpAllowed: true,
        openExternalBrowserCallback: (urlString: string) => {
          browserOpenCount++;
          return simulateOauthBrowserRedirect(urlString);
        },
      };

      await createConnectionsUsingPool(connectionOptions);

      assert.strictEqual(
        browserOpenCount,
        1,
        `expected 1 browser open but got ${browserOpenCount}`,
      );
    });
  });
});
