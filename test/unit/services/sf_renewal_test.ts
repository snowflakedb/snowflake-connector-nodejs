import assert from 'assert';
import sinon from 'sinon';

const SnowflakeService = require('../../../lib/services/sf');
const ConnectionConfig = require('../../../lib/connection/connection_config');
const Errors = require('../../../lib/errors');

interface ResponseBody {
  success: boolean;
  code?: string;
  data?: unknown;
}

interface HttpRequest {
  url: string;
  headers: Record<string, string>;
  json?: unknown;
  callback: (
    error?: Error,
    response?: { statusCode: number },
    body?: ResponseBody,
  ) => Promise<void>;
}

const expired = { success: false, code: '390112' };
const initialTime = 1_700_000_000_000;
const originalTokens = {
  sessionToken: 'synthetic-session-1',
  masterToken: 'synthetic-master-1',
  sessionTokenExpirationTime: initialTime + 60_000,
  masterTokenExpirationTime: initialTime + 3_600_000,
};

function completeData() {
  return {
    sessionToken: 'synthetic-session-2',
    masterToken: 'synthetic-master-2',
    validityInSecondsST: 60,
    validityInSecondsMT: 3600,
  };
}

describe('SnowflakeService renewal', function () {
  let service: InstanceType<typeof SnowflakeService>;
  let clock: sinon.SinonFakeTimers;
  let sent: HttpRequest[];
  let pending: HttpRequest[];

  function createService(tokenOnly = false) {
    const config = {
      accessUrl: 'https://renewal.snowflake.com',
      ...(tokenOnly ? { sessionToken: originalTokens.sessionToken } : {}),
      getAuthenticator: () => 'SNOWFLAKE',
      getPasscode: () => undefined,
      getPasscodeInPassword: () => false,
      getClientType: () => 'JavaScript',
      getClientVersion: () => 'test',
    };
    const httpClient = {
      request: (options: HttpRequest) => {
        assert.strictEqual(new URL(options.url).hostname, 'renewal.snowflake.com');
        sent.push(options);
        pending.push(options);
      },
    };
    return new SnowflakeService(
      config,
      httpClient,
      tokenOnly ? undefined : { tokenInfo: originalTokens },
    );
  }

  function take(path: string) {
    const request = pending.shift();
    assert.ok(request, `Missing request for ${path}`);
    assert.strictEqual(new URL(request.url).pathname, path);
    return request;
  }

  async function respond(request: HttpRequest, body: ResponseBody, statusCode = 200) {
    await request.callback(undefined, { statusCode }, body);
    await new Promise<void>((resolve) => setImmediate(resolve));
  }

  function request(path = '/queries/v1/query-request') {
    const callback = sinon.spy();
    const scope = {};
    service.request({ method: 'POST', url: path, callback, scope });
    return { callback, scope };
  }

  async function startRenewal(path = '/queries/v1/query-request') {
    const operation = request(path);
    await respond(take(path), expired);
    return { ...operation, renewal: take('/session/token-request') };
  }

  beforeEach(function () {
    clock = sinon.useFakeTimers({ now: initialTime, toFake: ['Date'] });
    sent = [];
    pending = [];
    service = createService();
  });

  afterEach(function () {
    sinon.restore();
  });

  for (const path of ['/session/heartbeat', '/queries/v1/query-request']) {
    for (const stable of [false, true]) {
      it(`refreshes complete ${stable ? 'stable-master alias' : 'rotated'} tokens twice for ${path}`, async function () {
        for (let cycle = 0; cycle < 2; cycle++) {
          const before = service.getConfig().tokenInfo;
          const { callback, scope, renewal } = await startRenewal(path);
          assert.strictEqual(
            renewal.headers.Authorization,
            `Snowflake Token="${before.masterToken}"`,
          );
          assert.deepStrictEqual(renewal.json, {
            requestType: 'RENEW',
            oldSessionToken: before.sessionToken,
          });
          const sessionToken = `synthetic-session-${cycle + 2}`;
          const masterToken = stable ? originalTokens.masterToken : `synthetic-master-${cycle + 2}`;
          const validity = stable ? 3600 - cycle * 10 : 3600;
          const data = stable
            ? {
                token: sessionToken,
                masterToken,
                validityInSeconds: 60,
                masterValidityInSeconds: validity,
              }
            : { sessionToken, masterToken, validityInSecondsST: 60, validityInSecondsMT: validity };
          await respond(renewal, { success: true, data });
          assert.deepStrictEqual(service.getConfig().tokenInfo, {
            sessionToken,
            masterToken,
            sessionTokenExpirationTime: Date.now() + 60_000,
            masterTokenExpirationTime: Date.now() + validity * 1000,
          });
          const replay = take(path);
          assert.strictEqual(replay.headers.Authorization, `Snowflake Token="${sessionToken}"`);
          await respond(replay, { success: true });
          assert.strictEqual(callback.callCount, 1);
          assert.strictEqual(callback.firstCall.args[0], undefined);
          assert.strictEqual(callback.firstCall.thisValue, scope);
          assert.strictEqual(service.isConnected(), true);
          clock.tick(10_000);
        }
        assert.strictEqual(sent.length, 6);
        assert.strictEqual(pending.length, 0);
      });
    }
  }

  const malformed: Array<[string, unknown]> = [
    ['missing data', undefined],
    ['null data', null],
    ['missing master', { ...completeData(), masterToken: undefined }],
    ['empty master', { ...completeData(), masterToken: '' }],
    ['non-string master', { ...completeData(), masterToken: 42 }],
    ['missing session', { ...completeData(), sessionToken: undefined }],
    ['blank session', { ...completeData(), sessionToken: '  ' }],
    ['non-string session', { ...completeData(), sessionToken: {} }],
  ];
  for (const field of ['validityInSecondsST', 'validityInSecondsMT']) {
    for (const value of [
      undefined,
      null,
      0,
      -1,
      NaN,
      Infinity,
      '60',
      true,
      Number.MAX_VALUE,
      Number.MIN_VALUE,
      8.64e12,
    ]) {
      malformed.push([`${field}=${String(value)}`, { ...completeData(), [field]: value }]);
    }
  }
  for (const [name, data] of malformed) {
    it(`rejects ${name} atomically and fails queued operations once`, async function () {
      const { callback, scope, renewal } = await startRenewal();
      const queued = request('/session/heartbeat');
      let beforeDisconnect;
      const disconnect = service.transitionToDisconnected.bind(service);
      sinon.stub(service, 'transitionToDisconnected').callsFake((context: unknown) => {
        beforeDisconnect = service.getConfig().tokenInfo;
        disconnect(context);
      });
      await respond(renewal, { success: true, data });
      assert.strictEqual(callback.callCount, 1);
      const error = callback.firstCall.args[0];
      assert.strictEqual(error.constructor, Error);
      assert.match(error.message, /Invalid session renewal response/);
      assert.strictEqual(callback.firstCall.thisValue, scope);
      assert.strictEqual(queued.callback.callCount, 1);
      assert.strictEqual(queued.callback.firstCall.args[0], error);
      assert.deepStrictEqual(beforeDisconnect, originalTokens);
      assert.strictEqual(service.isConnected(), false);
      assert.ok(Object.values(service.getConfig().tokenInfo).every((value) => value === undefined));
      assert.strictEqual(sent.length, 2);
      assert.strictEqual(pending.length, 0);
    });
  }

  for (const networkFailure of [false, true]) {
    it(`bounds repeated expiry after ${networkFailure ? 'network failures' : 'successful renewal'} per original request`, async function () {
      for (let operation = 0; operation < 2; operation++) {
        const { callback, renewal } = await startRenewal();
        let currentRenewal = renewal;
        for (let cycle = 0; cycle < 2; cycle++) {
          if (networkFailure) {
            await currentRenewal.callback(new Error('Synthetic transport failure'));
            assert.deepStrictEqual(service.getConfig().tokenInfo, originalTokens);
          } else {
            await respond(currentRenewal, { success: true, data: completeData() });
          }
          await respond(take('/queries/v1/query-request'), expired);
          if (cycle === 0) {
            currentRenewal = take('/session/token-request');
          }
        }
        assert.strictEqual(callback.callCount, 1);
        assert.strictEqual(callback.firstCall.args[0].code, '390112');
        assert.strictEqual(pending.length, 0);
        assert.strictEqual(service.isConnected(), true);
      }
      assert.strictEqual(sent.filter((r) => r.url.endsWith('/session/token-request')).length, 4);
      assert.strictEqual(sent.length, 10);
    });
  }

  it('recovers from a transient renewal network failure within the request budget', async function () {
    const { callback, renewal } = await startRenewal();
    await renewal.callback(new Error('Synthetic transport failure'));
    await respond(take('/queries/v1/query-request'), expired);
    await respond(take('/session/token-request'), { success: true, data: completeData() });
    await respond(take('/queries/v1/query-request'), { success: true });
    assert.strictEqual(callback.callCount, 1);
    assert.strictEqual(callback.firstCall.args[0], undefined);
    assert.strictEqual(sent.length, 5);
  });

  for (const code of ['390114', '390111', '390112']) {
    it(`preserves renewal server error ${code} without replay or login`, async function () {
      const { callback, renewal } = await startRenewal();
      await respond(renewal, { success: false, code });
      assert.strictEqual(callback.callCount, 1);
      assert.strictEqual(callback.firstCall.args[0].code, code);
      assert.strictEqual(service.isConnected(), false);
      assert.strictEqual(sent.length, 2);
      assert.strictEqual(pending.length, 0);
    });
  }

  it('schedules every failed queued operation before a request callback throws', async function () {
    const callbackError = new Error('Synthetic callback failure');
    const callback = sinon.stub().throws(callbackError);
    const scope = {};
    service.request({ method: 'POST', url: '/queries/v1/query-request', callback, scope });
    await respond(take('/queries/v1/query-request'), expired);
    const renewal = take('/session/token-request');
    const queued = request('/session/heartbeat');
    const destroyed = sinon.spy();
    service.destroy({ callback: destroyed });
    const disconnect = sinon.spy(service, 'transitionToDisconnected');
    const ticks: Array<() => void> = [];
    const nextTick = sinon.stub(process, 'nextTick').callsFake((callback, ...args) => {
      ticks.push(() => callback(...args));
    });
    let response;
    try {
      response = renewal.callback(
        undefined,
        { statusCode: 200 },
        { success: false, code: '390114' },
      );
      service.drainOperationQueue();
    } finally {
      nextTick.restore();
    }
    await response;

    const error = disconnect.firstCall.args[0].error;
    assert.strictEqual(error.code, '390114');
    assert.strictEqual(service.isConnected(), false);
    assert.strictEqual(callback.callCount, 0);
    assert.strictEqual(queued.callback.callCount, 0);
    assert.strictEqual(destroyed.callCount, 0);
    assert.strictEqual(ticks.length, 3);
    // Drive each tick separately: user errors escape, without uncaught Mocha errors.
    assert.throws(ticks[0], (error) => error === callbackError);
    ticks[1]();
    ticks[2]();
    assert.strictEqual(callback.callCount, 1);
    assert.strictEqual(callback.firstCall.args[0], error);
    assert.strictEqual(callback.firstCall.thisValue, scope);
    assert.strictEqual(queued.callback.callCount, 1);
    assert.strictEqual(queued.callback.firstCall.args[0], error);
    assert.strictEqual(queued.callback.firstCall.thisValue, queued.scope);
    assert.strictEqual(destroyed.callCount, 1);
    assert.strictEqual(
      destroyed.firstCall.args[0].code,
      Errors.codes.ERR_CONN_DESTROY_STATUS_DISCONNECTED,
    );
    assert.strictEqual(sent.length, 2);
    assert.strictEqual(pending.length, 0);
  });

  it('preserves an HTTP renewal failure without replay', async function () {
    const { callback, renewal } = await startRenewal();
    await respond(renewal, { success: false }, 500);
    assert.strictEqual(callback.callCount, 1);
    assert.strictEqual(callback.firstCall.args[0].code, Errors.codes.ERR_SF_RESPONSE_FAILURE);
    assert.strictEqual(service.isConnected(), false);
    assert.strictEqual(sent.length, 2);
  });

  for (const terminal of ['invalid session', 'destroy']) {
    it(`ignores a late renewal response after ${terminal}`, async function () {
      const terminalCallback = sinon.spy();
      if (terminal === 'destroy') {
        service.destroy({ callback: terminalCallback });
      } else {
        service.request({ method: 'POST', url: '/session/heartbeat', callback: terminalCallback });
      }
      const terminalRequest = take(terminal === 'destroy' ? '/session' : '/session/heartbeat');
      const { callback, renewal } = await startRenewal();
      await respond(
        terminalRequest,
        terminal === 'destroy' ? { success: true } : { success: false, code: '390111' },
      );
      assert.strictEqual(callback.callCount, 1);
      assert.strictEqual(
        callback.firstCall.args[0].code,
        Errors.codes.ERR_CONN_REQUEST_STATUS_DISCONNECTED,
      );
      await respond(renewal, { success: true, data: completeData() });
      assert.strictEqual(callback.callCount, 1);
      assert.strictEqual(terminalCallback.callCount, 1);
      assert.strictEqual(service.isConnected(), false);
      assert.ok(Object.values(service.getConfig().tokenInfo).every((value) => value === undefined));
      assert.strictEqual(sent.length, 3);
      assert.strictEqual(pending.length, 0);
    });
  }

  it('does not start renewal for an expired response received after destroy', async function () {
    const { callback } = request();
    const original = take('/queries/v1/query-request');
    service.destroy({ callback: sinon.spy() });
    await respond(take('/session'), { success: true });
    await respond(original, expired);
    assert.strictEqual(callback.callCount, 1);
    assert.strictEqual(callback.firstCall.args[0].code, '390112');
    assert.strictEqual(service.isConnected(), false);
    assert.strictEqual(sent.length, 2);
  });

  it('keeps token-only bootstrap compatibility and surfaces unrenewable failure', async function () {
    service = createService(true);
    assert.strictEqual(service.getConfig().tokenInfo.masterToken, originalTokens.sessionToken);
    const healthy = request('/session/heartbeat');
    await respond(take('/session/heartbeat'), { success: true });
    assert.strictEqual(healthy.callback.callCount, 1);
    const { callback, renewal } = await startRenewal();
    assert.strictEqual(
      renewal.headers.Authorization,
      `Snowflake Token="${originalTokens.sessionToken}"`,
    );
    await respond(renewal, { success: false, code: '390114' });
    assert.strictEqual(callback.callCount, 1);
    assert.strictEqual(callback.firstCall.args[0].code, '390114');
    assert.strictEqual(service.isConnected(), false);
    assert.strictEqual(sent.length, 3);
  });

  it('shares renewal between concurrent expired requests and drains each once', async function () {
    const query = request();
    const queryRequest = take('/queries/v1/query-request');
    const heartbeat = request('/session/heartbeat');
    const heartbeatRequest = take('/session/heartbeat');
    await respond(queryRequest, expired);
    const renewal = take('/session/token-request');
    await respond(heartbeatRequest, expired);
    assert.strictEqual(pending.length, 0);
    await respond(renewal, { success: true, data: completeData() });
    await respond(take('/queries/v1/query-request'), { success: true });
    await respond(take('/session/heartbeat'), { success: true });
    assert.strictEqual(query.callback.callCount, 1);
    assert.strictEqual(heartbeat.callback.callCount, 1);
    assert.strictEqual(query.callback.firstCall.args[0], undefined);
    assert.strictEqual(heartbeat.callback.firstCall.args[0], undefined);
    assert.strictEqual(sent.length, 5);
  });

  it('ignores a stale response from an earlier renewal generation', async function () {
    const { callback, renewal } = await startRenewal();
    await respond(renewal, { success: true, data: completeData() });
    await respond(take('/queries/v1/query-request'), expired);
    const secondRenewal = take('/session/token-request');
    await respond(renewal, { success: true, data: { ...completeData(), sessionToken: 'stale' } });
    assert.strictEqual(service.getConfig().tokenInfo.sessionToken, 'synthetic-session-2');
    assert.strictEqual(pending.length, 0);
    await respond(secondRenewal, { success: true, data: completeData() });
    await respond(take('/queries/v1/query-request'), { success: true });
    assert.strictEqual(callback.callCount, 1);
    assert.strictEqual(callback.firstCall.args[0], undefined);
    assert.strictEqual(sent.length, 5);
  });

  it('retains ordinary disconnected request errors', async function () {
    service.destroy({ callback: sinon.spy() });
    await respond(take('/session'), { success: true });
    const { callback } = request();
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.strictEqual(callback.callCount, 1);
    assert.strictEqual(
      callback.firstCall.args[0].code,
      Errors.codes.ERR_CONN_REQUEST_STATUS_DISCONNECTED,
    );
    assert.strictEqual(sent.length, 1);
  });

  it('bounds transient renewal failures with token-only bootstrap', async function () {
    service = createService(true);
    const { callback, renewal } = await startRenewal();
    await renewal.callback(new Error('Synthetic transport failure'));
    await respond(take('/queries/v1/query-request'), expired);
    await take('/session/token-request').callback(new Error('Synthetic transport failure'));
    await respond(take('/queries/v1/query-request'), expired);
    assert.strictEqual(callback.callCount, 1);
    assert.strictEqual(callback.firstCall.args[0].code, '390112');
    assert.strictEqual(sent.length, 5);
    assert.strictEqual(pending.length, 0);
  });

  it('does not apply renewal validation to session-only login responses', async function () {
    const config = new ConnectionConfig({
      account: 'synthetic',
      accessUrl: 'https://renewal.snowflake.com',
      username: 'synthetic',
      password: 'synthetic',
    });
    const callback = sinon.spy();
    service = new SnowflakeService(config, {
      request: async (options: HttpRequest) => {
        assert.strictEqual(new URL(options.url).hostname, 'renewal.snowflake.com');
        if (options.url.includes('/login-request')) {
          await options.callback(
            undefined,
            { statusCode: 200 },
            {
              success: true,
              data: { token: 'synthetic-issued-session', validityInSeconds: 60, parameters: [] },
            },
          );
        } else {
          await options.callback(undefined, { statusCode: 200 }, { success: true });
        }
      },
    });
    service.connect({ callback });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.strictEqual(callback.callCount, 1);
    assert.strictEqual(callback.firstCall.args[0], undefined);
    assert.strictEqual(service.getConfig().tokenInfo.sessionToken, 'synthetic-issued-session');
    assert.strictEqual(service.getConfig().tokenInfo.masterToken, undefined);
    assert.strictEqual(service.isConnected(), true);
  });
});
