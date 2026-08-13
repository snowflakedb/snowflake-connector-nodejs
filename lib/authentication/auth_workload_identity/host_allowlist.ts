import Logger from '../../logger';
import { isSnowflakeAllowedDomain, normalizeHost } from '../../url_util';

export const SNOWFLAKE_WIF_ALLOWED_HOST_SUFFIXES_ENV_VAR = 'SNOWFLAKE_WIF_ALLOWED_HOST_SUFFIXES';

export function validateHost(host: string): void {
  const normalized = normalizeHost(host);
  const extraSuffixes = getExtraAllowedSuffixes();

  if (!isSnowflakeAllowedDomain(normalized, extraSuffixes)) {
    throw new Error(
      `WORKLOAD_IDENTITY requires a recognized Snowflake host. Got: ${normalized}. This allowlist can be extended via the ${SNOWFLAKE_WIF_ALLOWED_HOST_SUFFIXES_ENV_VAR} environment variable.`,
    );
  }
}

let extraSuffixesLogged = false;
function getExtraAllowedSuffixes(): string[] {
  const raw = process.env[SNOWFLAKE_WIF_ALLOWED_HOST_SUFFIXES_ENV_VAR];
  if (!raw) {
    return [];
  }

  const extraSuffixes = raw
    .split(',')
    .map(normalizeHost)
    .filter((suffix) => suffix.length > 0);

  if (extraSuffixes.length > 0 && !extraSuffixesLogged) {
    Logger().info(
      `WORKLOAD_IDENTITY host allowlist extended via ${SNOWFLAKE_WIF_ALLOWED_HOST_SUFFIXES_ENV_VAR} with additional suffixes: ${extraSuffixes.join(', ')}`,
    );
    extraSuffixesLogged = true;
  }

  return extraSuffixes;
}
