import Logger from './logger';

/**
 * Recognized Snowflake domains. A valid Snowflake connection is expected to
 * target one of these domains or a subdomain of one.
 */
export const SNOWFLAKE_DOMAINS: readonly string[] = [
  'snowflakecomputing.com',
  'snowflakecomputing.cn',
  'snowflakecomputing.mil',
];

/**
 * Determines if a given URL is valid.
 */
export function isValidURL(url: string): boolean {
  const regex =
    '^http(s?)\\:\\/\\/[0-9a-zA-Z_]([-.\\w]*[0-9a-zA-Z@:])*(:(0-9)*)*(\\/?)([a-zA-Z0-9\\-\\.\\?\\,\\&\\(\\)\\/\\\\\\+&%\\$#_=@]*)?$';
  if (!url.match(regex)) {
    Logger().debug('The provided URL is not a valid URL. URL: %s', url);
    return false;
  }
  return true;
}

/**
 * Encodes the given URL.
 */
export function urlEncode(url: string): string {
  /** The encodeURIComponent() method encodes special characters including: , / ? : @ & = + $ #
     but escapes space as %20B. Replace with + for consistency across drivers. */
  return encodeURIComponent(url).replace(/%20/g, '+');
}

/**
 * Normalizes a host for allow-list matching and URL construction.
 * Trims whitespace, lowercases ASCII A–Z only, drops everything from the first
 * ':' onward (port), then strips exactly one trailing '.'.
 *
 * Lowercasing is ASCII-only to avoid Unicode case-folding surprises (e.g. the
 * Kelvin sign U+212A folds to 'k' under full Unicode lowercasing). Non-ASCII
 * characters are left unchanged so that isLdhHost can reject them.
 */
export function normalizeHost(rawHost: string): string {
  let host = rawHost.trim().replace(/[A-Z]/g, (c) => c.toLowerCase());
  const colonIndex = host.indexOf(':');
  if (colonIndex !== -1) {
    host = host.slice(0, colonIndex);
  }
  if (host.endsWith('.')) {
    host = host.slice(0, -1);
  }
  return host;
}

/**
 * Returns true if the already-normalized host contains only LDH characters
 * ([a-z0-9_-] per label, separated by '.'). Each label must be non-empty.
 *
 * This is an allow-list, not a block-list. Enumerating forbidden characters
 * does not work because parsers terminate the authority at spaces, semicolons,
 * quotes, percent-escapes, or full-width look-alikes of '.', '#', or '?'.
 */
export function isLdhHost(normalizedHost: string): boolean {
  if (!normalizedHost) return false;
  return normalizedHost.split('.').every((label) => /^[a-z0-9_-]+$/.test(label));
}

/**
 * Returns true if the normalized host is an allowed Snowflake domain (a
 * recognized Snowflake domain or a subdomain of one), including any extra
 * suffixes provided at runtime.
 */
export function isSnowflakeAllowedDomain(
  normalizedHost: string,
  extraSuffixes: string[] = [],
): boolean {
  return [...SNOWFLAKE_DOMAINS, ...extraSuffixes].some(
    (s) => normalizedHost === s || normalizedHost.endsWith(`.${s}`),
  );
}

/**
 * Returns true if the host is a Snowflake PrivateLink host of the form
 * <account>[.<region>].privatelink.<snowflake-suffix>, where the recognized
 * Snowflake domain must be at the end of the host (not merely contained in it).
 */
export function isPrivateLink(host: string): boolean {
  const normalized = normalizeHost(host);
  return (
    isLdhHost(normalized) &&
    isSnowflakeAllowedDomain(normalized) &&
    normalized.includes('.privatelink.')
  );
}
