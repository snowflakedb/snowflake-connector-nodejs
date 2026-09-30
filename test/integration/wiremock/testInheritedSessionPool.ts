import assert from 'assert';
import { Pool, Options } from 'generic-pool';
import { WireMockRestClient } from 'wiremock-rest-client';
import { runWireMockAsync, addWireMockMappingsFromFile } from '../../wiremockRunner';
import { getFreePort } from '../../../lib/util';
import { connectAsync, destroyConnectionAsync, executeCmdAsync } from '../testUtil';

// The root declarations are not importable in this checkout; use only the public surface.
const snowflake = require('../../../index.js');
type Connection = { isUp(): boolean };
type ConnectionOptions = {
  sessionToken?: string;
  serverSessionKeepAlive?: boolean;
  username?: string;
  password?: string;
  authenticator?: string;
  token?: string;
};
const sessionToken = 'synthetic-inherited-session-token';
const loginPath = '/session/v1/login-request';
const queryPath = '/queries/v1/query-request';

describe('Inherited session pool', function () {
  this.retries(0);

  let wiremock: WireMockRestClient;
  let baseOptions: { account: string; accessUrl: string };
  let pool: Pool<Connection> | undefined;
  let acquired: Connection[];

  function openPool(options: ConnectionOptions, poolOptions: Options = {}) {
    pool = snowflake.createPool(
      { ...baseOptions, ...options },
      { min: 0, max: 1, acquireTimeoutMillis: 2000, ...poolOptions },
    );
    return pool!;
  }

  async function acquire() {
    const connection = await pool!.acquire();
    acquired.push(connection);
    assert.strictEqual(connection.isUp(), true);
    return connection;
  }

  async function closePool() {
    const activePool = pool;
    pool = undefined;
    if (!activePool) return;
    for (const connection of acquired) {
      if (activePool.isBorrowedResource(connection)) await activePool.release(connection);
    }
    await activePool.drain();
    await activePool.clear();
  }

  async function expectRequests(urlPath: string, count: number, token?: string) {
    const { requests } = await wiremock.requests.findRequests({ method: 'POST', urlPath });
    assert.strictEqual(requests.length, count, urlPath);
    for (const request of requests) {
      if (token) assert.strictEqual(request.headers.Authorization, `Snowflake Token="${token}"`);
      if (urlPath === queryPath) assert.strictEqual(JSON.parse(request.body).sqlText, 'SELECT 1');
      if (urlPath === '/session') {
        assert.strictEqual(
          new URL(request.url, wiremock.baseUri).searchParams.get('delete'),
          'true',
        );
      }
    }
  }

  async function query(connection: Connection) {
    const { rows } = await executeCmdAsync(connection, 'SELECT 1');
    assert.deepStrictEqual(rows, [{ '1': 1 }]);
  }

  before(async function () {
    wiremock = await runWireMockAsync(await getFreePort(), { logLevel: 'error' });
    baseOptions = { account: 'synthetic-account', accessUrl: new URL(wiremock.baseUri).origin };
  });
  after(async () => wiremock.global.shutdown());
  beforeEach(async function () {
    acquired = [];
    await wiremock.mappings.deleteAllMappings();
    await wiremock.requests.deleteAllRequests();
    for (const name of ['login_request_ok', 'session_delete_ok', 'telemetry_send_ok']) {
      await addWireMockMappingsFromFile(wiremock, `wiremock/mappings/${name}.json`);
    }
    for (const [urlPath, data] of [
      ['/session/heartbeat', {}],
      [
        queryPath,
        {
          rowtype: [{ name: '1', type: 'fixed', scale: 0 }],
          rowset: [['1']],
          total: 1,
          returned: 1,
          queryId: 'synthetic-query',
          queryResultFormat: 'json',
        },
      ],
    ] as const) {
      await wiremock.mappings.createMapping({
        request: { method: 'POST', urlPath },
        response: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          jsonBody: { success: true, data },
        },
      });
    }
  });
  afterEach(async function () {
    await closePool();
    const { requests } = await wiremock.requests.getUnmatchedRequests();
    assert.deepStrictEqual(requests, []);
  });

  it('uses a directly created inherited connection without login', async function () {
    const connection = snowflake.createConnection({ ...baseOptions, sessionToken });
    try {
      assert.strictEqual(connection.isUp(), true);
      await query(connection);
    } finally {
      await destroyConnectionAsync(connection);
    }
    assert.strictEqual(connection.isUp(), false);
    await expectRequests(loginPath, 0);
    await expectRequests(queryPath, 1, sessionToken);
    await expectRequests('/session', 1, sessionToken);
  });

  for (const keepAlive of [false, true]) {
    it(`reuses inherited handles with validation and serverSessionKeepAlive=${keepAlive}`, async function () {
      openPool({ sessionToken, serverSessionKeepAlive: keepAlive }, { testOnBorrow: keepAlive });
      const connection = await acquire();
      await query(connection);
      await pool!.release(connection);
      assert.strictEqual(await acquire(), connection);
      await query(connection);
      await closePool();
      assert.strictEqual(connection.isUp(), false);
      await expectRequests(loginPath, 0);
      await expectRequests(queryPath, 2, sessionToken);
      await expectRequests('/session/heartbeat', keepAlive ? 2 : 0, sessionToken);
      await expectRequests('/session', keepAlive ? 0 : 1, sessionToken);
    });
  }

  it('honors max while distinct handles send the same inherited session token', async function () {
    openPool({ sessionToken, serverSessionKeepAlive: true }, { max: 3, maxWaitingClients: 0 });
    const connections = await Promise.all([acquire(), acquire(), acquire()]);
    assert.strictEqual(pool!.max, 3);
    assert.strictEqual(pool!.borrowed, 3);
    assert.strictEqual(new Set(connections).size, 3);
    await assert.rejects(acquire(), /max waitingClients count exceeded/);
    await Promise.all(connections.map(query));
    await closePool();
    assert.ok(connections.every((connection) => !connection.isUp()));
    await expectRequests(loginPath, 0);
    await expectRequests(queryPath, 3, sessionToken);
    await expectRequests('/session', 0);
  });

  for (const [name, credentials] of [
    ['password', { username: 'synthetic-user', password: 'synthetic-password' }],
    ['OAuth access token', { authenticator: 'OAUTH', token: 'synthetic-oauth-access-token' }],
  ] as const) {
    it(`connects ordinary ${name} connections directly and through the pool`, async function () {
      const direct = snowflake.createConnection({ ...baseOptions, ...credentials });
      try {
        assert.strictEqual(direct.isUp(), false);
        await connectAsync(direct);
        await query(direct);
      } finally {
        await destroyConnectionAsync(direct);
      }
      await expectRequests(loginPath, 1);
      openPool(credentials);
      await query(await acquire());
      await closePool();
      await expectRequests(loginPath, 2);
      await expectRequests(queryPath, 2, 'session token');
      await expectRequests('/session', 2, 'session token');
    });
  }

  it('propagates authentication errors to waiting acquisitions', async function () {
    const failure = { success: false, code: '390100', message: 'Synthetic authentication failure' };
    await wiremock.mappings.createMapping({
      priority: 1,
      request: { method: 'POST', urlPath: loginPath },
      response: {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(failure),
      },
    });
    const credentials = { username: 'synthetic-user', password: 'synthetic-password' };
    const direct = snowflake.createConnection({ ...baseOptions, ...credentials });
    try {
      await assert.rejects(connectAsync(direct), {
        name: 'OperationFailedError',
        code: failure.code,
        message: failure.message,
      });
      assert.strictEqual(direct.isUp(), false);
    } finally {
      if (direct.isUp()) await destroyConnectionAsync(direct);
    }
    // The pool wraps the public login error in Error, preserving its message, not its code.
    openPool(credentials, { max: 3 });
    await Promise.all(
      [acquire(), acquire(), acquire()].map((pending) =>
        assert.rejects(pending, { message: failure.message }),
      ),
    );
    await closePool();
    await expectRequests(loginPath, 4);
    await expectRequests(queryPath, 0);
  });

  it('propagates a use callback failure and destroys the inherited handle', async function () {
    const activePool = openPool({ sessionToken });
    const error = new Error('Synthetic callback failure');
    let used: Connection | undefined;
    await assert.rejects(
      activePool.use(async (connection) => {
        used = connection;
        await query(connection);
        throw error;
      }),
      (actual) => actual === error,
    );
    assert.strictEqual(activePool.borrowed, 0);
    assert.strictEqual(activePool.available, 0);
    await closePool();
    assert.strictEqual(used!.isUp(), false);
    await expectRequests(loginPath, 0);
    await expectRequests(queryPath, 1, sessionToken);
    await expectRequests('/session', 1, sessionToken);
  });
});
