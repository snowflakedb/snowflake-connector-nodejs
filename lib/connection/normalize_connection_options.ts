import { WIP_ConnectionOptions } from './types';

const KEY_ALIASES: Record<string, string> = {
  user: 'username',
  private_key_file: 'privateKeyPath',
};

const SNAKE_TO_CAMEL_OVERRIDES: Record<string, string> = {
  client_request_mfa_token: 'clientRequestMFAToken',
  force_gcp_use_downscoped_credential: 'forceGCPUseDownscopedCredential',
  disable_saml_url_check: 'disableSamlURLCheck',
  crl_allow_certificates_without_crl_url: 'crlAllowCertificatesWithoutCrlURL',
};

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

export function normalizeConnectionOptions(
  options: Record<string, unknown>,
): Partial<WIP_ConnectionOptions> {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(options)) {
    if (value === undefined) {
      continue;
    }

    if (KEY_ALIASES[key]) {
      if (normalized[KEY_ALIASES[key]] === undefined) {
        normalized[KEY_ALIASES[key]] = value;
      }
      continue;
    }

    if (SNAKE_TO_CAMEL_OVERRIDES[key]) {
      const target = SNAKE_TO_CAMEL_OVERRIDES[key];
      if (normalized[target] === undefined) {
        normalized[target] = value;
      }
      continue;
    }

    if (key === key.toLowerCase() && key.includes('_')) {
      const camelKey = snakeToCamel(key);
      if (normalized[camelKey] === undefined) {
        normalized[camelKey] = value;
      }
    } else {
      normalized[key] = normalized[key] !== undefined ? normalized[key] : value;
    }
  }

  return normalized as Partial<WIP_ConnectionOptions>;
}
