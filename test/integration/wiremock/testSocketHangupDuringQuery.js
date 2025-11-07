const assert = require('assert');
const os = require('os');
const snowflake = require('../../../lib/snowflake');
const testUtil = require('../testUtil');
const connParameters = require('../../authentication/connectionParameters');
const { runWireMockAsync, addWireMockMappingsFromFile } = require('../../wiremockRunner');
const { getFreePort } = require('../../../lib/util');

snowflake.configure({
  logLevel: 'TRACE',
});

describe('Integration: simulate socket hang up during query (WireMock)', function () {
  this.timeout(20000);

  let wireMock;
  let port;
  let connection;

  before(async () => {
    port = await getFreePort();
    wireMock = await runWireMockAsync(port);
    await addWireMockMappingsFromFile(
      wireMock,
      'wiremock/mappings/errors/query_two_fails_then_success.json',
    );
  });

  after(async () => {
    if (connection) {
      try {
        await testUtil.destroyConnectionAsync(connection);
      } catch (_) {
        // ignore
      }
    }
    await wireMock.global.shutdown();
  });

  it('connects successfully and fails execute with ECONNRESET', async function () {
    const connectionOptions = {
      ...connParameters.oauthPATOnWiremock,
      port: port,
      host: '127.0.0.1',
      token: 'MOCK_TOKEN',
      // proxyHost: "127.0.0.1",
      // proxyPort: port,
    };

    connection = snowflake.createConnection(connectionOptions);

    await testUtil.connectAsync(connection);
    assert.ok(connection.isUp(), 'Connection should be up before executing query');

    await new Promise((resolve, reject) => {
      connection.execute({
        sqlText: 'select 1',
        complete: async (err, statement) => {
          console.log('ERRRRR CALLBACK ----->', err);
          console.log('STATEMENT ----->', statement);
          try {
            assert.ok(err, 'Expected a network error due to socket hang up');
            assert.strictEqual(err.name, 'NetworkError');
            assert.ok(
              err.cause && (err.cause.code === 'ECONNRESET' || err.cause.code === 'ECONNABORTED'),
              `Expected inner error code ECONNRESET/ECONNABORTED, got: ${JSON.stringify(
                err,
                Object.getOwnPropertyNames(err),
              )}`,
            );
            resolve();
          } catch (assertErr) {
            reject(assertErr);
          }
        },
      });
    });
  });
});
