import Logger from '../logger';

export const PENDING_AUTHS = new Map<string, Promise<unknown>>();

function buildCoordinatorKey(host: string, username: string, authType: string): string {
  return `${host}:${username}:${authType}`;
}

export async function coordinateAuth(
  host: string,
  username: string,
  authType: string,
  authFn: () => Promise<unknown>,
): Promise<unknown> {
  const key = buildCoordinatorKey(host, username, authType);

  const existing = PENDING_AUTHS.get(key);
  if (existing) {
    Logger().debug('AuthCoordinator: auth already in progress for key %s, waiting for result', key);
    return existing;
  }

  const promise = authFn();
  promise.catch(() => {});
  PENDING_AUTHS.set(key, promise);

  Logger().debug('AuthCoordinator: first caller for key %s, running auth flow', key);

  try {
    return await promise;
  } finally {
    PENDING_AUTHS.delete(key);
  }
}
