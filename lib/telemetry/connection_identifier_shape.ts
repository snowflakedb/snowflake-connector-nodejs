/**
 * Build the wire payload for the `client_connection_identifier_shape`
 * in-band telemetry event from the raw user-supplied options.
 *
 * Must be called on the raw options object before any normalization
 * (dotted-account split, `.global` org-prefix strip, host inference)
 * runs, so the shape reflects user intent rather than the post-
 * normalization state of `ConnectionConfig`.
 *
 * No hostname or account value is included in the payload, only five
 * stringified-boolean flags describing which connection-identifier
 * fields the user supplied.
 *
 * TODO(SNOW-3548350): remove this module along with the emission site
 * in `lib/services/sf.js` once the data collection wraps up
 * (target: 2026-11-30).
 */
import { WIP_ConnectionOptions } from '../connection/types';

type BoolAsString = 'true' | 'false';

export interface ConnectionShapePayload {
  account_provided: BoolAsString;
  account_with_region: BoolAsString;
  account_org_provided: BoolAsString;
  region_provided: BoolAsString;
  host_provided: BoolAsString;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== '';
}

const stringify = (b: boolean): BoolAsString => (b ? 'true' : 'false');

export function buildConnectionShapePayload(
  options: Partial<WIP_ConnectionOptions>,
): ConnectionShapePayload {
  let accountProvided = false;
  let accountWithRegion = false;
  let accountOrgProvided = false;

  const account = options.account;
  if (isNonEmptyString(account)) {
    accountProvided = true;
    // Mirrors gosnowflake's `recordAccountShape` (gates on `i > 0`):
    // a leading dot leaves the full raw string as the account portion
    // and the dash search runs over the whole value.
    const dotIndex = account.indexOf('.');
    const accountPortion = dotIndex > 0 ? account.substring(0, dotIndex) : account;
    accountWithRegion = dotIndex > 0;
    accountOrgProvided = accountPortion.includes('-');
  }

  return {
    account_provided: stringify(accountProvided),
    account_with_region: stringify(accountWithRegion),
    account_org_provided: stringify(accountOrgProvided),
    region_provided: stringify(isNonEmptyString(options.region)),
    // `host` and `accessUrl` collapse into one flag: both mean "user
    // supplied an explicit endpoint". Wire schema stays five-keys flat.
    host_provided: stringify(isNonEmptyString(options.host) || isNonEmptyString(options.accessUrl)),
  };
}
