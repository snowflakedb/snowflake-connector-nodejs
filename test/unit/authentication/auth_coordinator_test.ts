import assert from 'assert';
import { coordinateAuth, clearPendingAuths } from '../../../lib/authentication/auth_coordinator';

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
});
