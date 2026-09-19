import sinon from 'sinon';

const GlobalConfig = require('../lib/global_config');
const SocketUtil = require('../lib/agent/socket_util');
const OcspResponseCache = require('../lib/agent/ocsp_response_cache');

export const OCSP_ENV_VARS = [
  'SF_OCSP_RESPONDER_URL',
  'SF_OCSP_RESPONSE_CACHE_SERVER_URL',
  'SF_OCSP_RESPONSE_CACHE_DIR',
  'SF_OCSP_TEST_CACHE_MAXAGE',
  'SF_OCSP_TEST_INJECT_UNKNOWN_STATUS',
  'SF_OCSP_TEST_INJECT_VALIDITY_ERROR',
  'SF_OCSP_TEST_OCSP_RESPONDER_TIMEOUT',
  'SF_OCSP_TEST_OCSP_RESPONSE_CACHE_SERVER_TIMEOUT',
] as const;

export function resetOcspState(): void {
  GlobalConfig._setOcspDefaults();
  SocketUtil.variables.OCSP_RESPONSE_CACHE = undefined;
  SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = true;
  OcspResponseCache.deleteCache();
}

export function enableOcsp(ocspFailOpen = true): void {
  // setOcspFailOpen() also flips disableOCSPChecks to false.
  GlobalConfig.setOcspFailOpen(ocspFailOpen);
}

export function setOcspCacheServerEnabled(enabled: boolean): void {
  SocketUtil.variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED = enabled;
}

// Requires a matching sinon.restore() in afterEach.
export function stubOcspEnv(overrides: Record<string, string> = {}): void {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const key of OCSP_ENV_VARS) {
    delete env[key];
  }
  sinon.stub(process, 'env').value({ ...env, ...overrides });
}
