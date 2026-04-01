import assert from 'assert';
import { WireMockRestClient } from 'wiremock-rest-client';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../../wiremockRunner';
import * as testUtil from '../testUtil';

// TODO:
// Consider dropping this test during UD migration as test/authentication/testSessionTokenRenewal.ts
// implements the same logic using a real backend.
describe('Session token renewal', function () {
  let wiremock: WireMockRestClient;
  let connectionConfig: any;

  before(async () => {
    const port = await testUtil.getFreePort();
    wiremock = await runWireMockAsync(port);
    connectionConfig = {
      account: 'test-account',
      accessUrl: `http://127.0.0.1:${port}`,
      proxyHost: '127.0.0.1',
      proxyPort: 8080,
    };
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/login_request_ok.json');
    await addWireMockMappingsFromFile(wiremock, 'wiremock/mappings/session_token_renewal.json');
  });

  after(async () => {
    await wiremock.global.shutdown();
  });

  it('renews expired session token and retries query', async function () {
    const connection = testUtil.createConnection(connectionConfig);
    await testUtil.connectAsync(connection);
    const rows = await testUtil.executeCmdAsync(connection, 'SELECT 1');
    assert.deepStrictEqual(rows, [{ '1': 1 }]);
  });
});
