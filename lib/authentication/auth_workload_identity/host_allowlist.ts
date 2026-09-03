import Logger from '../../logger';

export const SNOWFLAKE_WIF_ALLOWED_HOST_SUFFIXES_ENV_VAR = 'SNOWFLAKE_WIF_ALLOWED_HOST_SUFFIXES';

const DEFAULT_ALLOWED_HOST_SUFFIXES: readonly string[] = [
  'snowflakecomputing.com',
  'snowflakecomputing.cn',
  'snowflakecomputing.mil',
];

export function validateAccessUrl(accessUrl: string): void {
  const allowedSuffixes = getAllowedHostSuffixes();
  const host = normalizeHost(new URL(accessUrl).hostname);

  const isAllowed = allowedSuffixes.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );

  if (!isAllowed) {
    throw new Error(
      `WORKLOAD_IDENTITY requires a recognized Snowflake host (one of: ${allowedSuffixes.join(', ')}). Got: ${host}. This allowlist can be extended via the ${SNOWFLAKE_WIF_ALLOWED_HOST_SUFFIXES_ENV_VAR} environment variable.`,
    );
  }
}

/**
 * Only for testing. Reset the allowlist cache.
 */
export function resetAllowedHostSuffixesCache(): void {
  cachedAllowedHostSuffixes = undefined;
}

let cachedAllowedHostSuffixes: string[] | undefined;
function getAllowedHostSuffixes(): string[] {
  if (!cachedAllowedHostSuffixes) {
    cachedAllowedHostSuffixes = [
      ...DEFAULT_ALLOWED_HOST_SUFFIXES,
      ...getExtraAllowedSuffixesFromEnv(),
    ];
  }
  return cachedAllowedHostSuffixes;
}

function getExtraAllowedSuffixesFromEnv(): string[] {
  const raw = process.env[SNOWFLAKE_WIF_ALLOWED_HOST_SUFFIXES_ENV_VAR];
  if (!raw) {
    return [];
  }

  const extraSuffixes = raw
    .split(',')
    .map(normalizeHost)
    .filter((suffix) => suffix.length > 0);

  if (extraSuffixes.length > 0) {
    Logger().info(
      `WORKLOAD_IDENTITY host allowlist extended via ${SNOWFLAKE_WIF_ALLOWED_HOST_SUFFIXES_ENV_VAR} with additional suffixes: ${extraSuffixes.join(', ')}`,
    );
  }

  return extraSuffixes;
}

function normalizeHost(value: string): string {
  let normalized = value.trim().toLowerCase();
  if (normalized.endsWith('.')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}
