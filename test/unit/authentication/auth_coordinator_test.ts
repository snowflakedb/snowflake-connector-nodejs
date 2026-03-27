import assert from 'assert';
import {
  coordinateAuth,
  serializeFirstConnect,
  clearPendingAuths,
} from '../../../lib/authentication/auth_coordinator';

describe('AuthCoordinator', function () {
  afterEach(function () {
    clearPendingAuths();
  });

  describe('coordinateAuth', function () {
    it('returns the token from the auth function', async function () {
      const result = await coordinateAuth('host', 'user', 'OAUTH', async () => 'my-token');
      assert.strictEqual(result, 'my-token');
    });

    it('runs the auth function only once for concurrent calls with the same key', async function () {
      let callCount = 0;
      let resolveAuth: (value: string) => void;
      const authPromise = new Promise<string>((resolve) => {
        resolveAuth = resolve;
      });

      const authFn = async () => {
        callCount++;
        return authPromise;
      };

      const p1 = coordinateAuth('host', 'user', 'OAUTH', authFn);
      const p2 = coordinateAuth('host', 'user', 'OAUTH', authFn);
      const p3 = coordinateAuth('host', 'user', 'OAUTH', authFn);

      resolveAuth!('shared-token');

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
      assert.strictEqual(r1, 'shared-token');
      assert.strictEqual(r2, 'shared-token');
      assert.strictEqual(r3, 'shared-token');
      assert.strictEqual(callCount, 1);
    });

    it('uses separate auth flows for different keys', async function () {
      let callCount = 0;
      const authFn = async () => {
        callCount++;
        return `token-${callCount}`;
      };

      const [r1, r2] = await Promise.all([
        coordinateAuth('host', 'user1', 'OAUTH', authFn),
        coordinateAuth('host', 'user2', 'OAUTH', authFn),
      ]);

      assert.strictEqual(callCount, 2);
      assert.strictEqual(r1, 'token-1');
      assert.strictEqual(r2, 'token-2');
    });

    it('propagates errors to all waiting callers', async function () {
      let resolveAuth: () => void;
      const gate = new Promise<void>((resolve) => {
        resolveAuth = resolve;
      });

      const authFn = async () => {
        await gate;
        throw new Error('auth failed');
      };

      const p1 = coordinateAuth('host', 'user', 'OAUTH', authFn);
      const p2 = coordinateAuth('host', 'user', 'OAUTH', authFn);

      resolveAuth!();

      await assert.rejects(p1, { message: 'auth failed' });
      await assert.rejects(p2, { message: 'auth failed' });
    });

    it('allows a new auth flow after a previous one completes', async function () {
      const result1 = await coordinateAuth('host', 'user', 'OAUTH', async () => 'first');
      const result2 = await coordinateAuth('host', 'user', 'OAUTH', async () => 'second');

      assert.strictEqual(result1, 'first');
      assert.strictEqual(result2, 'second');
    });

    it('allows a new auth flow after a previous one fails', async function () {
      await assert.rejects(
        coordinateAuth('host', 'user', 'OAUTH', async () => {
          throw new Error('boom');
        }),
        { message: 'boom' },
      );

      const result = await coordinateAuth('host', 'user', 'OAUTH', async () => 'recovered');
      assert.strictEqual(result, 'recovered');
    });
  });

  describe('serializeFirstConnect', function () {
    it('runs the connect function and returns its result', async function () {
      const result = await serializeFirstConnect('host', 'user', 'EXTERNALBROWSER', async () => ({
        id: 'conn-1',
      }));
      assert.deepStrictEqual(result, { id: 'conn-1' });
    });

    it('serializes concurrent calls so the first completes before others start', async function () {
      const order: string[] = [];
      let resolveFirst: (value: string) => void;
      const firstGate = new Promise<string>((resolve) => {
        resolveFirst = resolve;
      });

      let callCount = 0;
      const connectFn = async () => {
        const myIndex = ++callCount;
        order.push(`start-${myIndex}`);
        if (myIndex === 1) {
          const result = await firstGate;
          order.push(`end-${myIndex}`);
          return result;
        }
        order.push(`end-${myIndex}`);
        return `conn-${myIndex}`;
      };

      const p1 = serializeFirstConnect('host', 'user', 'EXT', connectFn);
      const p2 = serializeFirstConnect('host', 'user', 'EXT', connectFn);

      await new Promise((r) => setTimeout(r, 10));

      assert.strictEqual(callCount, 1);

      resolveFirst!('conn-1');

      const [r1, r2] = await Promise.all([p1, p2]);
      assert.strictEqual(r1, 'conn-1');
      assert.strictEqual(r2, 'conn-2');

      assert.strictEqual(order[0], 'start-1');
      assert.strictEqual(order[1], 'end-1');
      assert.strictEqual(order[2], 'start-2');
    });

    it('allows second caller to proceed even if first fails', async function () {
      let callCount = 0;
      const connectFn = async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('first failed');
        }
        return 'recovered';
      };

      const p1 = serializeFirstConnect('host', 'user', 'EXT', connectFn);
      const p2 = serializeFirstConnect('host', 'user', 'EXT', connectFn);

      await assert.rejects(p1, { message: 'first failed' });
      const r2 = await p2;
      assert.strictEqual(r2, 'recovered');
    });
  });
});
