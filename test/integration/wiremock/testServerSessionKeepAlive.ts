import assert from 'assert';
import { WireMockRestClient } from 'wiremock-rest-client';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../../wiremockRunner';
import * as testUtil from '../testUtil';
import { getFreePort } from '../../../lib/util';

describe('serverSessionKeepAlive', function () {
  let wiremock: WireMockRestClient;
  let port: number;

  const sessionDeleteRequestPattern = {
    method: 'POST',
    urlPathPattern: '/session',
    queryParameters: {
      delete: { equalTo: 'true' },
    },
  };

  before(async () => {
    port = await getFreePort();
    wiremock = await runWireMockAsync(port);
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/login_request_ok.json');
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/session_delete_ok.json');
  });

  after(async () => {
    await wiremock.global.shutdown();
  });

  beforeEach(async () => {
    await wiremock.requests.deleteAllRequests();
  });

  [
    {
      name: 'does not send a session delete request when enabled',
      serverSessionKeepAlive: true,
      expectedDeleteCount: 0,
    },
    {
      name: 'sends a session delete request when disabled',
      serverSessionKeepAlive: false,
      expectedDeleteCount: 1,
    },
  ].forEach(({ name, serverSessionKeepAlive, expectedDeleteCount }) => {
    it(name, async function () {
      const connection = testUtil.createConnection({
        account: 'test-account',
        accessUrl: `http://127.0.0.1:${port}`,
        serverSessionKeepAlive,
      });
      await testUtil.connectAsync(connection);
      testUtil.assertConnectionActive(connection);

      await testUtil.destroyConnectionAsync(connection);
      testUtil.assertConnectionInactive(connection);

      const { count } = await wiremock.requests.getCount(sessionDeleteRequestPattern);
      assert.strictEqual(
        count,
        expectedDeleteCount,
        `expected ${expectedDeleteCount} session delete request(s) to be sent to the server`,
      );
    });
  });
});
