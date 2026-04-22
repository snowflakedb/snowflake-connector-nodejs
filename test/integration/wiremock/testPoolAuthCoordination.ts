import assert from 'assert';
import { WireMockRestClient } from 'wiremock-rest-client';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../../wiremockRunner';
import axios from 'axios';
import { PENDING_AUTHS } from '../../../lib/authentication/auth_coordinator';
import { WIP_ConnectionOptions } from '../../../lib/connection/types';
import { getFreePort } from '../../../lib/util';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const snowflake = require('../../../lib/snowflake').default;

const POOL_SIZE = 3;

async function createConnectionsUsingPool(connectionOptions: WIP_ConnectionOptions) {
  const pool = snowflake.createPool(connectionOptions, {
    max: POOL_SIZE,
    min: 0,
  });

  const acquirePromises = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    acquirePromises.push(pool.acquire());
  }

  const results = await Promise.allSettled(acquirePromises);
  const connections = results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
    .map((r) => r.value);

  for (const conn of connections) {
    await pool.release(conn);
  }
  await pool.drain();
  await pool.clear();

  return { connectedCount: connections.length, failedCount: results.length - connections.length };
}

describe('Pool auth coordination', function () {
  let wiremock: WireMockRestClient;
  let port: number;

  before(async function () {
    port = await getFreePort();
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
    it('opens browser only once for pooled connections', async function () {
      await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/login_request_ok.json');

      let browserOpenCount = 0;
      const connectionOptions = {
        accessUrl: `http://127.0.0.1:${port}`,
        authenticator: 'EXTERNALBROWSER',
        disableConsoleLogin: false,
        openExternalBrowserCallback: (loginUrl: string) => {
          browserOpenCount++;
          const url = new URL(loginUrl);
          const callbackPort = url.searchParams.get('browser_mode_redirect_port');
          return axios.get(`http://127.0.0.1:${callbackPort}/?token=test-token`).catch(() => {});
        },
      };

      const { connectedCount } = await createConnectionsUsingPool(connectionOptions);
      assert.strictEqual(connectedCount, POOL_SIZE);
      assert.strictEqual(browserOpenCount, 1);
    });

    it('propagates auth error to all pooled connections', async function () {
      let browserOpenCount = 0;

      const connectionOptions = {
        accessUrl: `http://127.0.0.1:${port}`,
        authenticator: 'EXTERNALBROWSER',
        disableConsoleLogin: false,
        browserActionTimeout: 100,
        openExternalBrowserCallback: () => {
          browserOpenCount++;
        },
      };

      const { failedCount } = await createConnectionsUsingPool(connectionOptions);
      assert.strictEqual(failedCount, POOL_SIZE);
      assert.strictEqual(browserOpenCount, 1);
    });
  });

  describe('OAUTH_AUTHORIZATION_CODE', function () {
    let baseConnectionOptions: WIP_ConnectionOptions;

    beforeEach(() => {
      baseConnectionOptions = {
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
      };
    });

    it('opens browser only once for pooled connections', async function () {
      await addWireMockMappingsFromFile(
        wiremock,
        'wiremock/mappings/oauth/authorization_code/successful_flow.json',
      );

      let browserOpenCount = 0;
      const connectionOptions = {
        ...baseConnectionOptions,
        openExternalBrowserCallback: (urlString: string) => {
          browserOpenCount++;
          const authUrl = new URL(urlString);
          const url = `${authUrl.searchParams.get('redirect_uri')}?code=test-code&state=${authUrl.searchParams.get('state')}`;
          return axios.get(url);
        },
      };

      const { connectedCount } = await createConnectionsUsingPool(connectionOptions);
      assert.strictEqual(connectedCount, POOL_SIZE);
      assert.strictEqual(browserOpenCount, 1);
    });

    it('propagates auth error to all pooled connections', async function () {
      let browserOpenCount = 0;
      const connectionOptions = {
        ...baseConnectionOptions,
        browserActionTimeout: 100,
        openExternalBrowserCallback: () => {
          browserOpenCount++;
        },
      };

      const { failedCount } = await createConnectionsUsingPool(connectionOptions);
      assert.strictEqual(failedCount, POOL_SIZE);
      assert.strictEqual(browserOpenCount, 1);
    });
  });
});
