import assert from 'assert';
import sinon from 'sinon';
import { WireMockRestClient } from 'wiremock-rest-client';
import * as testUtil from '../testUtil';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../../wiremockRunner';
import { rest } from '../../../lib/global_config';
import axios from 'axios';
import { clearPendingAuths } from '../../../lib/authentication/auth_coordinator';
import { withBrowserActionTimeout } from '../../../lib/authentication/authentication_util';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const snowflake = require('../../../lib/snowflake').default;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const GlobalConfig = require('../../../lib/global_config');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  JsonCredentialManager,
} = require('../../../lib/authentication/secure_storage/json_credential_manager');

const POOL_SIZE = 3;

function simulateExternalBrowserRedirect(loginUrl: string) {
  const url = new URL(loginUrl);
  const token = url.searchParams.get('proof_key') || 'mock-token';
  const callbackPort = url.searchParams.get('browser_mode_redirect_port');
  return axios.get(`http://127.0.0.1:${callbackPort}/?token=${token}`).catch(() => {});
}

function simulateOauthBrowserRedirect(urlString: string) {
  const redirectUri = new URL(urlString);
  const url = `${redirectUri.searchParams.get('redirect_uri')}?code=9s6wFkGDOjmgNEdwJMlDzv1AwxDjDVBxiT6wVqXjG5s&state=${redirectUri.searchParams.get('state')}`;
  return withBrowserActionTimeout(3000, axios.get(url));
}

describe('Pool auth coordination', function () {
  describe('EXTERNALBROWSER', function () {
    let wiremock: WireMockRestClient;
    let port: number;

    before(async function () {
      port = await testUtil.getFreePort();
      wiremock = await runWireMockAsync(port);
      sinon.stub(rest, 'HTTPS_PROTOCOL').value('http');
    });

    afterEach(async function () {
      clearPendingAuths();
      await wiremock.scenarios.resetAllScenarios();
      await wiremock.mappings.resetAllMappings();
    });

    after(async function () {
      await wiremock.global.shutdown();
      sinon.restore();
    });

    it('opens browser only once for pooled connections', async function () {
      await addWireMockMappingsFromFile(
        wiremock,
        'wiremock/mappings/external_browser/successful_flow.json',
      );

      let browserOpenCount = 0;

      const connectionOptions = {
        account: 'MOCK_ACCOUNT_NAME',
        username: 'MOCK_USERNAME',
        host: `127.0.0.1:${port}`,
        accessUrl: `http://127.0.0.1:${port}`,
        protocol: 'http',
        authenticator: 'EXTERNALBROWSER',
        disableConsoleLogin: false,
        openExternalBrowserCallback: (loginUrl: string) => {
          browserOpenCount++;
          return simulateExternalBrowserRedirect(loginUrl);
        },
      };

      const pool = snowflake.createPool(connectionOptions, {
        max: POOL_SIZE,
        min: 0,
      });

      const connections: any[] = [];
      const acquirePromises = [];
      for (let i = 0; i < POOL_SIZE; i++) {
        acquirePromises.push(
          pool.acquire().then((conn: any) => {
            connections.push(conn);
            return conn;
          }),
        );
      }
      await Promise.all(acquirePromises);

      assert.strictEqual(connections.length, POOL_SIZE, `expected ${POOL_SIZE} connections`);
      assert.strictEqual(
        browserOpenCount,
        1,
        `expected 1 browser open but got ${browserOpenCount}`,
      );

      for (const conn of connections) {
        await pool.release(conn);
      }
      await pool.drain();
      await pool.clear();
    });
  });

  describe('OAUTH_AUTHORIZATION_CODE', function () {
    let wiremock: WireMockRestClient;
    let port: number;

    before(async function () {
      port = await testUtil.getFreePort();
      wiremock = await runWireMockAsync(port);
      GlobalConfig.setCustomCredentialManager(new JsonCredentialManager());
    });

    afterEach(async function () {
      clearPendingAuths();
      await wiremock.scenarios.resetAllScenarios();
      await wiremock.mappings.resetAllMappings();
    });

    after(async function () {
      await wiremock.global.shutdown();
    });

    it('opens browser only once for pooled connections', async function () {
      await addWireMockMappingsFromFile(
        wiremock,
        'wiremock/mappings/oauth/authorization_code/successful_flow.json',
      );

      let browserOpenCount = 0;

      const connectionOptions = {
        account: 'MOCK_ACCOUNT_NAME',
        username: 'MOCK_USERNAME',
        host: '127.0.0.1',
        protocol: 'http',
        port: port,
        role: 'ANALYST',
        authenticator: 'OAUTH_AUTHORIZATION_CODE',
        oauthClientId: '123',
        oauthClientSecret: 'clientSecret',
        oauthAuthorizationUrl: `https://127.0.0.1:${port}/oauth/authorize`,
        oauthTokenRequestUrl: `http://127.0.0.1:${port}/oauth/token-request`,
        oauthRedirectUri: 'http://localhost:8009/snowflake/oauth-redirect',
        oauthScope: 'session:role:ANALYST test-scope',
        oauthHttpAllowed: true,
        openExternalBrowserCallback: (urlString: string) => {
          browserOpenCount++;
          return simulateOauthBrowserRedirect(urlString);
        },
      };

      const pool = snowflake.createPool(connectionOptions, {
        max: POOL_SIZE,
        min: 0,
      });

      const connections: any[] = [];
      const acquirePromises = [];
      for (let i = 0; i < POOL_SIZE; i++) {
        acquirePromises.push(
          pool.acquire().then((conn: any) => {
            connections.push(conn);
            return conn;
          }),
        );
      }
      await Promise.all(acquirePromises);

      assert.strictEqual(connections.length, POOL_SIZE, `expected ${POOL_SIZE} connections`);
      assert.strictEqual(
        browserOpenCount,
        1,
        `expected 1 browser open but got ${browserOpenCount}`,
      );

      for (const conn of connections) {
        await pool.release(conn);
      }
      await pool.drain();
      await pool.clear();
    });
  });
});
