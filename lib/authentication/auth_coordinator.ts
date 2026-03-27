import Logger from '../logger';

interface PendingAuth<T = string> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: Error) => void;
}

const pendingAuths = new Map<string, PendingAuth<unknown>>();

function buildCoordinatorKey(host: string, username: string, authType: string): string {
  return `${host}:${username}:${authType}`;
}

export async function coordinateAuth(
  host: string,
  username: string,
  authType: string,
  authFn: () => Promise<string>,
): Promise<string> {
  const key = buildCoordinatorKey(host, username, authType);

  const existing = pendingAuths.get(key) as PendingAuth<string> | undefined;
  if (existing) {
    Logger().debug(
      'AuthCoordinator: auth already in progress for key %s, waiting for result',
      key.substring(0, 8),
    );
    return existing.promise;
  }

  let resolve!: (value: string) => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<string>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.catch(() => {});

  pendingAuths.set(key, { promise, resolve, reject } as PendingAuth<unknown>);

  Logger().debug(
    'AuthCoordinator: first caller for key %s, running auth flow',
    key.substring(0, 8),
  );

  try {
    const token = await authFn();
    resolve(token);
    return token;
  } catch (err) {
    reject(err instanceof Error ? err : new Error(String(err)));
    throw err;
  } finally {
    pendingAuths.delete(key);
  }
}

export async function serializeFirstConnect<T>(
  host: string,
  username: string,
  authType: string,
  connectFn: () => Promise<T>,
): Promise<T> {
  const key = buildCoordinatorKey(host, username, authType + '_connect');

  const existing = pendingAuths.get(key) as PendingAuth<T> | undefined;
  if (existing) {
    Logger().debug(
      'AuthCoordinator: connect in progress for key %s, waiting before starting own connect',
      key.substring(0, 8),
    );
    try {
      await existing.promise;
    } catch {
      // first connection failed; proceed with our own attempt anyway
    }
    return connectFn();
  }

  let resolve!: (value: T) => void;
  let reject!: (err: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  promise.catch(() => {});

  pendingAuths.set(key, { promise, resolve, reject } as PendingAuth<unknown>);

  Logger().debug(
    'AuthCoordinator: first connect for key %s, running connect flow',
    key.substring(0, 8),
  );

  try {
    const result = await connectFn();
    resolve(result);
    return result;
  } catch (err) {
    reject(err instanceof Error ? err : new Error(String(err)));
    throw err;
  } finally {
    pendingAuths.delete(key);
  }
}

export function clearPendingAuths(): void {
  pendingAuths.clear();
}
