/**
 * Capture user-supplied connection-identifier provenance for in-band
 * telemetry.
 *
 * The shape captured here is consumed by the `client_connection_identifier_shape`
 * telemetry event emitted from `lib/services/sf.js` after a successful login.
 * The capture function inspects the raw options that
 * `consolidateHostAndAccount(options)` receives, before any normalization
 * (account-string truncation at the first dot, `.global` org-prefix
 * stripping, host inference from `accessUrl`/`account`, etc.) runs, so the
 * shape reflects user intent rather than the final post-normalization state
 * of the `ConnectionConfig` instance.
 *
 * No hostname or account value is included in the emitted payload, only
 * five stringified-boolean flags describing which connection-identifier
 * fields the user supplied.
 *
 * TODO(SNOW-3548350): remove this module and its emission site after the
 * connection-identifier-shape data collection wraps up
 * (target: 2026-11-30).
 */

/**
 * Provenance of connection-identifier fields the user supplied.
 *
 * All fields describe what the user supplied at the moment of input — they
 * reflect intent, not the final post-normalization state of the connection.
 *
 * - `accountProvided`: the user explicitly set `options.account`.
 * - `accountWithRegion`: the raw account string the user typed contained a
 *   dot (e.g. `"myacct.us-east-1"`), signaling the deprecated
 *   `account.region` embedded form. Set only on the raw input.
 * - `accountOrgProvided`: the raw account string carried a dash in its
 *   account portion (e.g. `"myorg-myacct"`), signaling the org-prefixed
 *   form. Region-portion dashes (e.g. the `-east-` in
 *   `"myacct.us-east-1"`) are intentionally not counted; only the portion
 *   before the first `.` is examined.
 * - `regionProvided`: the user explicitly set `options.region` as a
 *   distinct option. A region embedded inside a dotted account string is
 *   NOT `regionProvided`; that is `accountWithRegion`.
 * - `hostProvided`: the user explicitly set `options.host` OR
 *   `options.accessUrl`. Node.js exposes a fully-qualified `accessUrl`
 *   (scheme + host + port) as a fourth identifier dimension that the Go,
 *   Python and JDBC drivers do not have; for shape purposes both options
 *   mean "the user supplied an explicit endpoint", so they collapse into
 *   the same flag and the wire schema stays the five-keys flat shared
 *   across drivers.
 *
 * TODO(SNOW-3548350): remove this dataclass with the telemetry emission
 * (target: 2026-11-30).
 */
export interface ConnectionIdentifierShape {
  accountProvided: boolean;
  accountWithRegion: boolean;
  accountOrgProvided: boolean;
  regionProvided: boolean;
  hostProvided: boolean;
}

function isUserSuppliedString(value: unknown): value is string {
  // A connection option counts as user-supplied iff it is a non-empty
  // string. Non-string truthy values (e.g. an accidentally-passed `true`
  // or number) are not treated as provided here — the regular validation
  // in `ConnectionConfig` will reject them later, and shape capture is
  // best kept conservative.
  return typeof value === 'string' && value !== '';
}

/**
 * Capture the connection-identifier shape from the raw options object that
 * `consolidateHostAndAccount(options)` receives.
 *
 * Must be invoked before any normalization (the dotted-account split, the
 * `-org` strip, the `Util.constructHostname` synthesis, the `accessUrl`
 * URL parsing) runs — otherwise inferred values become indistinguishable
 * from user-supplied ones and `hostProvided` / `accountProvided` are no
 * longer trustworthy.
 *
 * TODO(SNOW-3548350): remove this function with the telemetry emission
 * (target: 2026-11-30).
 */
export function recordInputShape(
  options: Record<string, unknown> | null | undefined,
): ConnectionIdentifierShape {
  const shape: ConnectionIdentifierShape = {
    accountProvided: false,
    accountWithRegion: false,
    accountOrgProvided: false,
    regionProvided: false,
    hostProvided: false,
  };

  if (options == null) {
    return shape;
  }

  const account = options.account;
  if (isUserSuppliedString(account)) {
    shape.accountProvided = true;
    const dotIndex = account.indexOf('.');
    // Only a dot at position > 0 splits the string into account / region;
    // a leading dot (pathological input like `.us-east-1`) leaves the
    // full raw string as the "account portion". Mirrors gosnowflake's
    // `recordAccountShape` (internal/config/dsn.go), which gates on
    // `i > 0` so the dash search runs over the full value when there is
    // no real account/region split. The Go reference implementation is
    // the cross-driver spec for this telemetry; the Python sibling does
    // the same.
    //
    // Region-tail dashes (the `-east-` inside `"myacct.us-east-1"`) are
    // excluded by virtue of being outside `accountPortion`, not by a
    // position check.
    const accountPortion = dotIndex > 0 ? account.substring(0, dotIndex) : account;
    shape.accountWithRegion = dotIndex > 0;
    shape.accountOrgProvided = accountPortion.includes('-');
  }

  shape.regionProvided = isUserSuppliedString(options.region);

  // accessUrl is a Node.js-only fourth identifier dimension (a fully
  // qualified URL with scheme + host + port) that Go/Python/JDBC do not
  // expose. For shape purposes both `host` and `accessUrl` mean "the
  // user supplied an explicit endpoint", so they collapse into the same
  // `hostProvided` flag. The wire schema stays the five-keys flat shared
  // across drivers; `accessUrl` is not a sixth key.
  shape.hostProvided =
    isUserSuppliedString(options.host) || isUserSuppliedString(options.accessUrl);

  return shape;
}

/**
 * Wire-format keys for the `client_connection_identifier_shape` telemetry
 * event. Values are stringified booleans (`"true"` / `"false"`) to match
 * the existing client_connection_parameters telemetry style and the
 * byte-identical envelope produced by the Go, Python, and JDBC drivers.
 *
 * TODO(SNOW-3548350): remove with the telemetry emission
 * (target: 2026-11-30).
 */
export interface ConnectionIdentifierShapePayload {
  account_provided: 'true' | 'false';
  account_with_region: 'true' | 'false';
  account_org_provided: 'true' | 'false';
  region_provided: 'true' | 'false';
  host_provided: 'true' | 'false';
}

/**
 * Stringify each boolean flag of a `ConnectionIdentifierShape` into the
 * five wire-format keys consumed by `buildInbandTelemetryRequest` as the
 * payload of the `client_connection_identifier_shape` event.
 *
 * TODO(SNOW-3548350): remove with the telemetry emission
 * (target: 2026-11-30).
 */
export function shapeToTelemetryPayload(
  shape: ConnectionIdentifierShape,
): ConnectionIdentifierShapePayload {
  return {
    account_provided: shape.accountProvided ? 'true' : 'false',
    account_with_region: shape.accountWithRegion ? 'true' : 'false',
    account_org_provided: shape.accountOrgProvided ? 'true' : 'false',
    region_provided: shape.regionProvided ? 'true' : 'false',
    host_provided: shape.hostProvided ? 'true' : 'false',
  };
}
