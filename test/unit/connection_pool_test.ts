import assert from 'assert';
import sinon, { SinonSpy } from 'sinon';
import { Pool } from 'generic-pool';
import Connection from '../../lib/connection/connection';
import NodeLogger from '../../lib/logger/node';

const Core = require('../../lib/core');

type DriverConnection = InstanceType<typeof Connection>;

interface HttpRequest {
  url: string;
  headers: Record<string, string>;
  callback: (error: Error | null, response: { statusCode: number }, body: object) => Promise<void>;
}

const inheritedOptions = {
  account: 'pool_account',
  accessUrl: 'https://pool.snowflake.com',
  sessionToken: 'synthetic-inherited-session-token',
};
const ordinaryOptions = {
  account: 'pool_account',
  accessUrl: 'https://pool.snowflake.com',
  username: 'synthetic-user',
  password: 'synthetic-password',
};

describe('Connection pool factory', function () {
  let pool: Pool<DriverConnection> | undefined;
  let connections: DriverConnection[];
  let connectSpies: SinonSpy[];
  let requests: HttpRequest[];
  let loginError: boolean;

  function createDriver() {
    return Core({
      loggerClass: NodeLogger,
      client: { version: '0.0.0', environment: {} },
      connectionClass: function (context: ConstructorParameters<typeof Connection>[0]) {
        const connection = new Connection(context);
        connections.push(connection);
        connectSpies.push(sinon.spy(connection, 'connect'));
        return connection;
      },
      httpClient: {
        request(request: HttpRequest) {
          const url = new URL(request.url);
          assert.strictEqual(url.origin, 'https://pool.snowflake.com');
          requests.push(request);
          let body: object = { success: true, data: {} };
          if (url.pathname === '/session/v1/login-request') {
            body = loginError
              ? { success: false, code: '390100', message: 'Synthetic authentication failure' }
              : {
                  success: true,
                  data: {
                    token: 'synthetic-login-session-token',
                    masterToken: 'synthetic-master-token',
                    validityInSeconds: 3600,
                    masterValidityInSeconds: 3600,
                    sessionId: 123,
                    parameters: [],
                  },
                };
          } else {
            assert.ok(
              url.pathname === '/session/heartbeat' ||
                url.pathname === '/telemetry/send' ||
                (url.pathname === '/session' && url.searchParams.get('delete') === 'true'),
              `Unexpected request: ${url.pathname}`,
            );
          }
          setImmediate(() => {
            void request.callback(null, { statusCode: 200 }, body);
          });
        },
      },
    });
  }

  async function closePool() {
    const poolToClose = pool;
    pool = undefined;
    if (poolToClose) {
      for (const connection of connections) {
        if (poolToClose.isBorrowedResource(connection)) {
          await poolToClose.release(connection);
        }
      }
      await poolToClose.drain();
      await poolToClose.clear();
    }
  }

  beforeEach(function () {
    pool = undefined;
    connections = [];
    connectSpies = [];
    requests = [];
    loginError = false;
  });

  afterEach(async function () {
    try {
      await closePool();
    } finally {
      sinon.restore();
    }
  });

  it('acquires and reuses an inherited session without connecting again', async function () {
    pool = createDriver().createPool(inheritedOptions, { min: 0, max: 1 });
    const connection = await pool!.acquire();
    assert.strictEqual(connection.isUp(), true);
    assert.strictEqual(connection, connections[0]);
    sinon.assert.notCalled(connectSpies[0]);
    assert.strictEqual(requests.length, 0);

    await pool!.release(connection);
    assert.strictEqual(await pool!.acquire(), connection);
    assert.strictEqual(connections.length, 1);
    assert.strictEqual(requests.length, 0);

    await closePool();
    assert.strictEqual(connection.isUp(), false);
    assert.strictEqual(requests.length, 1);
    assert.strictEqual(new URL(requests[0].url).searchParams.get('delete'), 'true');
    assert.strictEqual(
      requests[0].headers.Authorization,
      'Snowflake Token="synthetic-inherited-session-token"',
    );
  });

  it('validates inherited sessions on borrow and honors serverSessionKeepAlive', async function () {
    pool = createDriver().createPool(
      { ...inheritedOptions, serverSessionKeepAlive: true },
      { min: 0, max: 1, testOnBorrow: true },
    );
    const connection = await pool!.acquire();
    sinon.assert.notCalled(connectSpies[0]);
    assert.strictEqual(requests.length, 1);
    assert.strictEqual(new URL(requests[0].url).pathname, '/session/heartbeat');
    assert.strictEqual(
      requests[0].headers.Authorization,
      'Snowflake Token="synthetic-inherited-session-token"',
    );

    await closePool();
    assert.strictEqual(connection.isUp(), false);
    assert.strictEqual(requests.length, 1);
  });

  it('preserves the configured maximum and shares the supplied session across distinct handles', async function () {
    pool = createDriver().createPool(inheritedOptions, { min: 0, max: 3 });
    const acquired = await Promise.all([pool!.acquire(), pool!.acquire(), pool!.acquire()]);
    assert.strictEqual(pool!.max, 3);
    assert.strictEqual(pool!.borrowed, 3);
    assert.strictEqual(new Set(acquired).size, 3);
    for (const connection of acquired) {
      assert.strictEqual(
        JSON.parse(connection.serialize()).services.sf.tokenInfo.sessionToken,
        inheritedOptions.sessionToken,
      );
    }
    connectSpies.forEach((spy) => sinon.assert.notCalled(spy));
    assert.strictEqual(requests.length, 0);
  });

  for (const [name, options] of [
    ['password', ordinaryOptions],
    [
      'OAuth access token',
      { ...ordinaryOptions, authenticator: 'OAUTH', token: 'synthetic-oauth-access-token' },
    ],
  ] as const) {
    it(`connects ordinary ${name} connections before acquiring them`, async function () {
      pool = createDriver().createPool(options, { min: 0, max: 1 });
      const connection = await pool!.acquire();
      assert.strictEqual(connection.isUp(), true);
      sinon.assert.calledOnce(connectSpies[0]);
      const loginRequests = requests.filter(
        (request) => new URL(request.url).pathname === '/session/v1/login-request',
      );
      assert.strictEqual(loginRequests.length, 1);
    });
  }

  it('propagates authentication errors to waiting acquisitions', async function () {
    loginError = true;
    pool = createDriver().createPool(ordinaryOptions, { min: 0, max: 3 });
    await Promise.all(
      [pool!.acquire(), pool!.acquire(), pool!.acquire()].map((acquisition) =>
        assert.rejects(acquisition, { message: 'Synthetic authentication failure' }),
      ),
    );
    assert.strictEqual(connections.length, 3);
    connectSpies.forEach((spy) => sinon.assert.calledOnce(spy));
  });

  it('propagates a use callback error and destroys the inherited connection', async function () {
    pool = createDriver().createPool(inheritedOptions, { min: 0, max: 1 });
    const error = new Error('Synthetic callback failure');
    await assert.rejects(
      pool!.use(async () => {
        throw error;
      }),
      (actual) => actual === error,
    );
    assert.strictEqual(pool!.borrowed, 0);
    assert.strictEqual(pool!.available, 0);
    await closePool();
    assert.strictEqual(connections[0].isUp(), false);
    assert.strictEqual(requests.length, 1);
    assert.strictEqual(new URL(requests[0].url).searchParams.get('delete'), 'true');
  });
});
