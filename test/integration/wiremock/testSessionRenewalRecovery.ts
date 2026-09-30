import assert from 'assert';
import { ChildProcess, fork } from 'child_process';
import { once } from 'events';
import { join } from 'path';
import { setTimeout as delay } from 'timers/promises';
import { runWireMockAsync } from '../../wiremockRunner';
import { ResponseDefinition } from 'wiremock-rest-client/dist/model/response-definition.model';
import { StubMapping } from 'wiremock-rest-client/dist/model/stub-mapping.model';

const snowflake = require('../../../index');
type Connection = ReturnType<typeof snowflake.createConnection>;
type DriverError = Error & { code?: string | number };
const queryPath = '/queries/v1/query-request';
const heartbeatPath = '/session/heartbeat';
const renewalPath = '/session/token-request';
const loginPath = '/session/v1/login-request';
const expired = { success: false, code: '390112' };
const auth = (token: string) => `Snowflake Token="${token}"`;
const tokens = (generation = 2) => ({
  sessionToken: `synthetic-session-${generation}`,
  masterToken: `synthetic-master-${generation}`,
  validityInSecondsST: 60,
  validityInSecondsMT: 3600,
});
const queryResult = {
  success: true,
  data: {
    queryId: '00000000-0000-4000-8000-000000000001',
    rowtype: [{ name: '1', type: 'fixed', scale: 0, precision: 1 }],
    rowset: [['1']],
    total: 1,
    returned: 1,
    parameters: [],
  },
};
const json = (body: object, fixedDelayMilliseconds = 0): ResponseDefinition => ({
  status: 200,
  headers: { 'Content-Type': 'application/json' },
  jsonBody: body,
  fixedDelayMilliseconds,
});

// Streamed execution reports the original error without an extra result-fetch retry.
function execute(connection: Connection, streamResult = true) {
  let calls = 0;
  const done = new Promise<{ error?: DriverError; rows?: unknown }>((resolve) => {
    connection.execute({
      sqlText: 'SELECT 1',
      streamResult,
      complete: (error?: DriverError, _statement?: unknown, rows?: unknown) => {
        calls++;
        resolve({ error, rows });
      },
    });
  });
  return {
    done,
    get calls() {
      return calls;
    },
  };
}

function destroy(connection: Connection) {
  return new Promise<DriverError | undefined>((resolve) => connection.destroy(resolve));
}

describe('Public session renewal recovery', function () {
  this.timeout(15000);
  this.retries(0);
  let wiremock: Awaited<ReturnType<typeof runWireMockAsync>>;
  let accessUrl: string;
  let connections: Connection[];
  let stopped = false;
  let callbackChild: ChildProcess | undefined;
  let watchdog: NodeJS.Timeout;

  async function stopServer() {
    stopped = true;
    callbackChild?.kill('SIGKILL');
    await wiremock?.stop();
  }

  async function stub(
    path: string,
    response: ResponseDefinition,
    extra: Partial<StubMapping> = {},
  ) {
    await wiremock.mappings.createMapping({
      request: { method: 'POST', urlPath: path },
      response,
      ...extra,
    });
  }

  async function sequence(path: string, responses: ResponseDefinition[]) {
    for (const [index, response] of responses.entries()) {
      await stub(path, response, {
        scenarioName: path,
        requiredScenarioState: index === 0 ? 'Started' : String(index),
        ...(index + 1 < responses.length ? { newScenarioState: String(index + 1) } : {}),
      });
    }
  }

  async function requests(path: string) {
    const { requests } = await wiremock.requests.findRequests({ urlPath: path });
    return requests as Array<{ url: string; body: string; headers: Record<string, string> }>;
  }

  // Wait for server receipt, not a guessed client-side scheduling delay.
  async function waitForRequest(path: string) {
    const deadline = Date.now() + 5000;
    while ((await requests(path)).length === 0) {
      assert.ok(Date.now() < deadline, `No request received for ${path}`);
      await delay(10);
    }
  }

  async function renewalRequests(expected: Array<[string, string]>) {
    const received = await requests(renewalPath);
    assert.strictEqual(received.length, expected.length);
    // Journal order is newest first; compare the exact token pairs without relying on ordering.
    assert.deepStrictEqual(
      received.map((request) => [request.headers.Authorization, JSON.parse(request.body)]).sort(),
      expected
        .map(([master, session]) => [
          auth(master),
          {
            requestType: 'RENEW',
            oldSessionToken: session,
          },
        ])
        .sort(),
    );
  }

  async function connect(tokenOnly = false) {
    const connection = snowflake.createConnection({
      account: 'synthetic',
      username: 'synthetic',
      password: 'synthetic',
      accessUrl,
      timeout: 5000,
      ...(tokenOnly ? { sessionToken: 'synthetic-session-1' } : {}),
    });
    connections.push(connection);
    if (!tokenOnly) {
      await new Promise<void>((resolve, reject) =>
        connection.connect((error?: Error) => (error ? reject(error) : resolve())),
      );
    }
    return connection;
  }

  async function assertTerminal(connection: Connection) {
    const before = await requests(queryPath);
    assert.strictEqual(await connection.isValidAsync(), false);
    const later = execute(connection);
    assert.strictEqual((await later.done).error?.code, 407002);
    assert.strictEqual(later.calls, 1);
    assert.deepStrictEqual(await requests(queryPath), before, 'No authorized reuse after failure');
    assert.strictEqual((await requests(loginPath)).length, 1);
  }

  before(async function () {
    this.timeout(65000);
    wiremock = await runWireMockAsync(undefined, {
      enableBrowserProxying: false,
      logLevel: 'error',
    });
    accessUrl = wiremock.rootUrl;
  });

  beforeEach(async () => {
    assert.ok(!stopped, 'WireMock stopped after a previous failure');
    connections = [];
    // Mocha timeouts alone do not cancel an unbounded renewal loop.
    watchdog = setTimeout(() => {
      for (const connection of connections) connection.destroy(() => {});
      void stopServer().catch(() => {});
      throw new Error('Renewal test watchdog expired; owned server stopped');
    }, 12000);
    await wiremock.global.resetAll();
    await stub(
      loginPath,
      json({
        success: true,
        data: {
          ...tokens(1),
          parameters: [{ name: 'CLIENT_TELEMETRY_ENABLED', value: false }],
        },
      }),
    );
    await stub('/telemetry/send', json({ success: true }));
    await stub('/session', json({ success: true }));
    await stub(heartbeatPath, json({ success: true }), { priority: 10 });
  });

  afterEach(async function () {
    let cleanupTimer: NodeJS.Timeout | undefined;
    try {
      // A failed regression must not keep issuing requests during later tests.
      if (this.currentTest?.state === 'failed') {
        for (const connection of connections) connection.destroy(() => {});
        await stopServer();
        return;
      }
      await Promise.race([
        Promise.all(connections.map(destroy)),
        new Promise((_, reject) => {
          cleanupTimer = setTimeout(() => reject(new Error('Connection cleanup timed out')), 1000);
        }),
      ]);
      const { requests: unmatched } = await wiremock.requests.getUnmatchedRequests();
      assert.deepStrictEqual(unmatched, [], 'Unexpected driver traffic');
    } catch (error) {
      await stopServer();
      throw error;
    } finally {
      clearTimeout(cleanupTimer);
      clearTimeout(watchdog);
    }
  });

  after(async () => {
    clearTimeout(watchdog);
    await stopServer();
  });

  for (const path of [queryPath, heartbeatPath]) {
    for (const mode of ['canonical rotated', 'legacy stable master', 'canonical unchanged']) {
      it(`replays twice with ${mode} tokens for ${path}`, async () => {
        const connection = await connect();
        await sequence(path, [
          json(expired),
          json(path === queryPath ? queryResult : { success: true }),
          json(expired),
          json(path === queryPath ? queryResult : { success: true }),
        ]);
        const sessions = mode.endsWith('unchanged') ? [1, 1, 1] : [1, 2, 3];
        const masters = mode.endsWith('rotated') ? [1, 2, 3] : [1, 1, 1];
        await sequence(
          renewalPath,
          [1, 2].map((cycle) =>
            json({
              success: true,
              data: mode.startsWith('legacy')
                ? {
                    token: `synthetic-session-${sessions[cycle]}`,
                    masterToken: `synthetic-master-${masters[cycle]}`,
                    validityInSeconds: 60,
                    masterValidityInSeconds: 3600 - cycle,
                  }
                : { ...tokens(sessions[cycle]), masterToken: `synthetic-master-${masters[cycle]}` },
            }),
          ),
        );
        for (let cycle = 0; cycle < 2; cycle++) {
          if (path === queryPath) {
            const operation = execute(connection, false);
            assert.deepStrictEqual(await operation.done, { error: null, rows: [{ '1': 1 }] });
            assert.strictEqual(operation.calls, 1);
          } else {
            assert.strictEqual(await connection.isValidAsync(), true);
          }
        }
        await renewalRequests(
          [0, 1].map((cycle) => [
            `synthetic-master-${masters[cycle]}`,
            `synthetic-session-${sessions[cycle]}`,
          ]),
        );
        assert.deepStrictEqual(
          (await requests(path)).map((r) => r.headers.Authorization).sort(),
          [sessions[0], sessions[1], sessions[1], sessions[2]]
            .map((n) => auth(`synthetic-session-${n}`))
            .sort(),
        );
        assert.strictEqual((await requests(loginPath)).length, 1);
      });
    }
  }

  const malformed: Array<[string, unknown]> = [
    ['missing data', undefined],
    ['null data', null],
    ['missing master', { ...tokens(), masterToken: undefined }],
    ['empty master', { ...tokens(), masterToken: '' }],
    ['non-string master', { ...tokens(), masterToken: 42 }],
    ['missing session', { ...tokens(), sessionToken: undefined }],
    ['blank session', { ...tokens(), sessionToken: '  ' }],
    ['non-string session', { ...tokens(), sessionToken: {} }],
  ];
  // NaN and Infinity serialize to null; null covers their wire representation.
  for (const field of ['validityInSecondsST', 'validityInSecondsMT']) {
    for (const value of [
      undefined,
      null,
      0,
      -1,
      '60',
      true,
      Number.MAX_VALUE,
      Number.MIN_VALUE,
      8.64e12,
    ]) {
      malformed.push([`${field}=${String(value)}`, { ...tokens(), [field]: value }]);
    }
  }
  for (const [name, data] of malformed) {
    it(`rejects ${name} and completes queued operations once`, async () => {
      const connection = await connect();
      // A broken driver may replay; return success so the assertion fails without looping.
      await sequence(queryPath, [json(expired), json(queryResult)]);
      await stub(renewalPath, json({ success: true, data }, 250));
      const operation = execute(connection);
      await waitForRequest(renewalPath);
      const queued = execute(connection);
      const health = connection.isValidAsync();
      for (const result of await Promise.all([operation.done, queued.done])) {
        assert.ok(result.error instanceof Error);
        assert.match(result.error.message, /Invalid session renewal response/);
      }
      assert.strictEqual(await health, false);
      await assertTerminal(connection);
      assert.deepStrictEqual([operation.calls, queued.calls], [1, 1]);
      await renewalRequests([['synthetic-master-1', 'synthetic-session-1']]);
      assert.strictEqual((await requests(queryPath)).length, 1);
      assert.strictEqual((await requests(heartbeatPath)).length, 0);
    });
  }

  for (const tokenOnly of [false, true]) {
    for (const fault of [false, true]) {
      it(`bounds repeated expiry after ${fault ? 'network faults' : 'successful renewals'} (${tokenOnly ? 'token-only' : 'login'})`, async () => {
        const connection = await connect(tokenOnly);
        await stub(queryPath, json(expired));
        await stub(
          renewalPath,
          fault ? { fault: 'EMPTY_RESPONSE' } : json({ success: true, data: tokens() }),
        );
        for (let index = 0; index < 2; index++) {
          const operation = execute(connection);
          assert.strictEqual((await operation.done).error?.code, '390112');
          assert.strictEqual(operation.calls, 1);
          assert.strictEqual(await connection.isValidAsync(), true);
        }
        assert.strictEqual((await requests(queryPath)).length, 6);
        const initialMaster = tokenOnly ? 'synthetic-session-1' : 'synthetic-master-1';
        await renewalRequests(
          fault
            ? Array.from({ length: 4 }, (): [string, string] => [
                initialMaster,
                'synthetic-session-1',
              ])
            : [
                [initialMaster, 'synthetic-session-1'],
                ...Array.from({ length: 3 }, (): [string, string] => [
                  'synthetic-master-2',
                  'synthetic-session-2',
                ]),
              ],
        );
        assert.strictEqual((await requests(loginPath)).length, tokenOnly ? 0 : 1);
      });
    }
  }

  it('recovers from a transient renewal fault without losing the original tokens', async () => {
    const connection = await connect();
    await sequence(queryPath, [json(expired), json(expired), json(queryResult)]);
    await sequence(renewalPath, [
      { fault: 'EMPTY_RESPONSE' },
      json({ success: true, data: tokens() }),
    ]);
    const operation = execute(connection, false);
    assert.deepStrictEqual((await operation.done).rows, [{ '1': 1 }]);
    assert.strictEqual(operation.calls, 1);
    await renewalRequests(
      Array.from({ length: 2 }, () => ['synthetic-master-1', 'synthetic-session-1']),
    );
    assert.deepStrictEqual(
      (await requests(queryPath)).map((r) => r.headers.Authorization).sort(),
      [
        auth('synthetic-session-1'),
        auth('synthetic-session-1'),
        auth('synthetic-session-2'),
      ].sort(),
    );
  });

  for (const code of ['390114', '390111', '390112', 401002]) {
    it(`preserves renewal ${code === 401002 ? 'HTTP 500' : `server error ${code}`} without replay or login`, async () => {
      const connection = await connect();
      await stub(queryPath, json(expired));
      await stub(renewalPath, {
        ...json({ success: false, code, message: 'Synthetic renewal failure' }, 250),
        status: code === 401002 ? 500 : 200,
      });
      const operation = execute(connection);
      await waitForRequest(renewalPath);
      const queued = execute(connection);
      const closing = destroy(connection);
      for (const result of await Promise.all([operation.done, queued.done])) {
        assert.strictEqual(result.error?.code, code);
      }
      assert.strictEqual((await closing)?.code, 406502);
      await assertTerminal(connection);
      assert.deepStrictEqual([operation.calls, queued.calls], [1, 1]);
      assert.strictEqual((await requests(queryPath)).length, 1);
      assert.strictEqual((await requests('/session')).length, 0);
      await renewalRequests([['synthetic-master-1', 'synthetic-session-1']]);
    });
  }

  it('shares renewal across concurrent expired requests and a queued operation', async () => {
    const connection = await connect();
    await sequence(queryPath, [json(expired, 50), json(queryResult)]);
    await sequence(heartbeatPath, [json(expired, 50), json({ success: true })]);
    await stub(renewalPath, json({ success: true, data: tokens() }, 300));
    const operation = execute(connection, false);
    const health = connection.isValidAsync();
    await waitForRequest(renewalPath);
    const queued = execute(connection, false);
    for (const result of await Promise.all([operation.done, queued.done])) {
      assert.deepStrictEqual(result.rows, [{ '1': 1 }]);
    }
    assert.strictEqual(await health, true);
    assert.deepStrictEqual([operation.calls, queued.calls], [1, 1]);
    assert.deepStrictEqual(
      (await requests(heartbeatPath)).map((r) => r.headers.Authorization).sort(),
      [auth('synthetic-session-1'), auth('synthetic-session-2')].sort(),
    );
    assert.strictEqual((await requests(loginPath)).length, 1);
    await renewalRequests([['synthetic-master-1', 'synthetic-session-1']]);
    assert.deepStrictEqual(
      (await requests(queryPath)).map((r) => r.headers.Authorization).sort(),
      [
        auth('synthetic-session-1'),
        auth('synthetic-session-2'),
        auth('synthetic-session-2'),
      ].sort(),
    );
  });

  for (const terminal of ['destroy', 'invalid session']) {
    it(`does not revive after a late renewal response following ${terminal}`, async () => {
      const connection = await connect();
      await stub(queryPath, json(expired));
      await stub(renewalPath, json({ success: true, data: tokens() }, 700));
      const terminalPath = terminal === 'destroy' ? '/session' : heartbeatPath;
      await stub(
        terminalPath,
        json(terminal === 'destroy' ? { success: true } : { success: false, code: '390111' }, 300),
        {
          priority: 1,
          scenarioName: 'terminal response',
          requiredScenarioState: 'Started',
          newScenarioState: 'Finished',
        },
      );
      const ending = terminal === 'destroy' ? destroy(connection) : connection.isValidAsync();
      await waitForRequest(terminalPath);
      const operation = execute(connection);
      await waitForRequest(renewalPath);
      await ending;
      assert.strictEqual((await operation.done).error?.code, 407002);
      await delay(750); // Let the already-issued server response reach the real transport.
      // A healthy fallback must not re-close a connection incorrectly revived by the late response.
      await assertTerminal(connection);
      assert.strictEqual(
        (await requests(heartbeatPath)).length,
        terminal === 'invalid session' ? 1 : 0,
      );
      assert.strictEqual(operation.calls, 1);
      assert.strictEqual((await requests(queryPath)).length, 1);
      await renewalRequests([['synthetic-master-1', 'synthetic-session-1']]);
    });
  }

  it('does not renew an expired response received after destroy', async () => {
    const connection = await connect();
    await stub(queryPath, json(expired, 250));
    const operation = execute(connection);
    await waitForRequest(queryPath);
    assert.strictEqual(await destroy(connection), undefined);
    assert.strictEqual((await operation.done).error?.code, '390112');
    await assertTerminal(connection);
    assert.strictEqual(operation.calls, 1);
    const received = await requests(queryPath);
    // destroy() closes pooled sockets. The HTTP middleware may retry that already-issued
    // request below the session state machine; it is not a new public operation or RENEW.
    assert.ok(received.length === 1 || received.length === 2);
    const urls = received.map((request) => new URL(request.url, accessUrl));
    assert.strictEqual(new Set(urls.map((url) => url.searchParams.get('requestId'))).size, 1);
    assert.strictEqual(urls.filter((url) => !url.searchParams.has('retryCount')).length, 1);
    if (received.length === 2) {
      assert.strictEqual(
        urls.find((url) => url.searchParams.has('retryCount'))?.searchParams.get('retryCount'),
        '1',
      );
    }
    for (const request of received) {
      assert.strictEqual(request.headers.Authorization, auth('synthetic-session-1'));
      assert.strictEqual(JSON.parse(request.body).sqlText, 'SELECT 1');
    }
    await renewalRequests([]);
  });

  it('uses a token-only connection without login and surfaces an unrenewable failure', async () => {
    const connection = await connect(true);
    assert.strictEqual(await connection.isValidAsync(), true);
    await stub(queryPath, json(expired));
    await stub(renewalPath, json({ success: false, code: '390114' }));
    const operation = execute(connection);
    assert.strictEqual((await operation.done).error?.code, '390114');
    assert.strictEqual(await connection.isValidAsync(), false);
    assert.strictEqual(operation.calls, 1);
    await renewalRequests([['synthetic-session-1', 'synthetic-session-1']]);
    assert.strictEqual((await requests(loginPath)).length, 0);
  });

  it('accepts ordinary session-only login responses', async () => {
    await stub(
      loginPath,
      json({
        success: true,
        data: {
          token: 'synthetic-issued-session',
          validityInSeconds: 60,
          parameters: [],
        },
      }),
      { priority: 1 },
    );
    const connection = await connect();
    assert.strictEqual(await connection.isValidAsync(), true);
    assert.deepStrictEqual(
      (await requests(heartbeatPath)).map((r) => r.headers.Authorization),
      [auth('synthetic-issued-session')],
    );
    await renewalRequests([]);
  });

  it('schedules queued callbacks independently of a throwing user callback', async () => {
    await stub(queryPath, json(expired));
    await stub(renewalPath, json({ success: false, code: '390114' }, 1000));
    const child = (callbackChild = fork(
      join(__dirname, '../../fixtures/renewalCallbackChild.ts'),
      [accessUrl],
      {
        execArgv: ['-r', 'ts-node/register'],
        silent: true,
      },
    ));
    const messages: unknown[] = [];
    child.on('message', (message) => messages.push(message));
    let stderr = '';
    child.stderr!.on('data', (chunk) => {
      stderr += chunk;
    });
    const exited = once(child, 'close', { signal: AbortSignal.timeout(11000) });
    try {
      const [code] = await exited;
      assert.strictEqual(code, 0, stderr);
      assert.deepStrictEqual(messages.slice().sort(), [
        'caught',
        'destroy:406502',
        'queued:390114',
        'throwing:390114',
      ]);
      assert.ok(messages.indexOf('caught') > messages.indexOf('throwing:390114'));
      await renewalRequests([['synthetic-master-1', 'synthetic-session-1']]);
      assert.strictEqual((await requests(queryPath)).length, 1);
      assert.strictEqual((await requests('/session')).length, 0);
    } finally {
      if (child.exitCode === null) child.kill('SIGKILL');
      callbackChild = undefined;
    }
  });
});
