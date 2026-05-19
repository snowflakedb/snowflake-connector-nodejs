import assert from 'node:assert';
import {
  ConnectionIdentifierShape,
  recordInputShape,
  shapeToTelemetryPayload,
} from '../../../lib/connection/connection_identifier_shape';

interface ShapeCase {
  name: string;
  options: Record<string, unknown> | null | undefined;
  expected: ConnectionIdentifierShape;
}

const cases: ShapeCase[] = [
  {
    name: 'bare account flips only account_provided',
    options: { account: 'myacct' },
    expected: {
      accountProvided: true,
      accountWithRegion: false,
      accountOrgProvided: false,
      regionProvided: false,
      hostProvided: false,
    },
  },
  {
    name: 'dotted account flips account_with_region (deprecated account.region form)',
    options: { account: 'myacct.us-east-1' },
    expected: {
      accountProvided: true,
      accountWithRegion: true,
      accountOrgProvided: false,
      regionProvided: false,
      hostProvided: false,
    },
  },
  {
    name: 'org-prefixed account flips account_org_provided',
    options: { account: 'myorg-myacct' },
    expected: {
      accountProvided: true,
      accountWithRegion: false,
      accountOrgProvided: true,
      regionProvided: false,
      hostProvided: false,
    },
  },
  {
    name: 'org-prefix + dotted account flips both account_with_region and account_org_provided',
    options: { account: 'myorg-myacct.us-east-1' },
    expected: {
      accountProvided: true,
      accountWithRegion: true,
      accountOrgProvided: true,
      regionProvided: false,
      hostProvided: false,
    },
  },
  {
    name: 'region-tail dashes do NOT count toward account_org_provided',
    // The "-east-" dashes live in the region portion, not the account
    // portion. The Go/Python references intentionally only inspect the
    // substring before the first dot to avoid this misclassification.
    options: { account: 'myacct.us-east-1' },
    expected: {
      accountProvided: true,
      accountWithRegion: true,
      accountOrgProvided: false,
      regionProvided: false,
      hostProvided: false,
    },
  },
  {
    name: '.global URL with org prefix still counted (capture is on raw input)',
    // `.global` stripping happens during normalization. Shape capture
    // runs before normalization, so the raw input still has the dash
    // and the dot.
    options: { account: 'myorg-myacct.us-west-2.global' },
    expected: {
      accountProvided: true,
      accountWithRegion: true,
      accountOrgProvided: true,
      regionProvided: false,
      hostProvided: false,
    },
  },
  {
    name: 'region kwarg flips region_provided',
    options: { region: 'us-east-1' },
    expected: {
      accountProvided: false,
      accountWithRegion: false,
      accountOrgProvided: false,
      regionProvided: true,
      hostProvided: false,
    },
  },
  {
    name: 'host only flips host_provided',
    options: { host: 'myacct.snowflakecomputing.com' },
    expected: {
      accountProvided: false,
      accountWithRegion: false,
      accountOrgProvided: false,
      regionProvided: false,
      hostProvided: true,
    },
  },
  {
    name: 'accessUrl only flips host_provided (Node.js-specific dimension)',
    // Node.js exposes a fully-qualified `accessUrl` (scheme + host + port)
    // that Go/Python/JDBC do not. For shape purposes both `host` and
    // `accessUrl` mean "the user supplied an explicit endpoint", so the
    // wire schema stays the five-keys flat.
    options: { accessUrl: 'https://myacct.snowflakecomputing.com:443' },
    expected: {
      accountProvided: false,
      accountWithRegion: false,
      accountOrgProvided: false,
      regionProvided: false,
      hostProvided: true,
    },
  },
  {
    name: 'host + accessUrl both set still flips host_provided exactly once',
    options: {
      host: 'myacct.snowflakecomputing.com',
      accessUrl: 'https://myacct.snowflakecomputing.com',
    },
    expected: {
      accountProvided: false,
      accountWithRegion: false,
      accountOrgProvided: false,
      regionProvided: false,
      hostProvided: true,
    },
  },
  {
    name: 'all five identifier dimensions provided',
    options: {
      account: 'myorg-myacct.us-east-1',
      region: 'us-west-2',
      host: 'override.snowflakecomputing.com',
      accessUrl: 'https://override.snowflakecomputing.com',
    },
    expected: {
      accountProvided: true,
      accountWithRegion: true,
      accountOrgProvided: true,
      regionProvided: true,
      hostProvided: true,
    },
  },
  {
    name: 'undefined options returns all-false shape',
    options: undefined,
    expected: {
      accountProvided: false,
      accountWithRegion: false,
      accountOrgProvided: false,
      regionProvided: false,
      hostProvided: false,
    },
  },
  {
    name: 'null options returns all-false shape',
    options: null,
    expected: {
      accountProvided: false,
      accountWithRegion: false,
      accountOrgProvided: false,
      regionProvided: false,
      hostProvided: false,
    },
  },
  {
    name: 'empty-string account is not user-supplied',
    options: { account: '' },
    expected: {
      accountProvided: false,
      accountWithRegion: false,
      accountOrgProvided: false,
      regionProvided: false,
      hostProvided: false,
    },
  },
  {
    name: 'empty-string host is not user-supplied',
    options: { host: '' },
    expected: {
      accountProvided: false,
      accountWithRegion: false,
      accountOrgProvided: false,
      regionProvided: false,
      hostProvided: false,
    },
  },
  {
    name: 'empty-string accessUrl is not user-supplied',
    options: { accessUrl: '' },
    expected: {
      accountProvided: false,
      accountWithRegion: false,
      accountOrgProvided: false,
      regionProvided: false,
      hostProvided: false,
    },
  },
  {
    name: 'non-string truthy account (defensive) is not user-supplied',
    // Shape capture runs before `ConnectionConfig`'s validation rejects
    // non-string values, so we deliberately stay conservative here and
    // ignore non-string truthy junk rather than guessing.
    options: { account: 12345 },
    expected: {
      accountProvided: false,
      accountWithRegion: false,
      accountOrgProvided: false,
      regionProvided: false,
      hostProvided: false,
    },
  },
  {
    name: 'irrelevant kwargs do not perturb the shape',
    options: {
      username: 'someone',
      password: 'secret',
      warehouse: 'WH',
      role: 'ANALYST',
      privateKey: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----',
    },
    expected: {
      accountProvided: false,
      accountWithRegion: false,
      accountOrgProvided: false,
      regionProvided: false,
      hostProvided: false,
    },
  },
  {
    name: 'leading-dot account does not split — dash search runs over the full raw value',
    // Pathological input — the user couldn't realistically configure
    // this, but the spec needs to be unambiguous. gosnowflake's
    // `recordAccountShape` (internal/config/dsn.go) gates the dot-split
    // on `i > 0`, so a leading dot leaves the full string as the
    // "account portion" and the dash search runs over the whole value.
    // `accountWithRegion` stays false because there is no real
    // account/region split (the account portion is genuinely empty
    // otherwise); `accountOrgProvided` flips true because the full
    // string contains a dash.
    options: { account: '.us-east-1' },
    expected: {
      accountProvided: true,
      accountWithRegion: false,
      accountOrgProvided: true,
      regionProvided: false,
      hostProvided: false,
    },
  },
];

describe('recordInputShape', () => {
  for (const tc of cases) {
    it(tc.name, () => {
      assert.deepStrictEqual(recordInputShape(tc.options), tc.expected);
    });
  }

  it('does not mutate the input options object', () => {
    const options = { account: 'myorg-myacct.us-east-1', region: 'us-west-2' };
    const before = JSON.stringify(options);
    recordInputShape(options);
    assert.strictEqual(JSON.stringify(options), before);
  });
});

describe('shapeToTelemetryPayload', () => {
  it('stringifies all five flags as the cross-driver wire-format keys', () => {
    const payload = shapeToTelemetryPayload({
      accountProvided: true,
      accountWithRegion: false,
      accountOrgProvided: true,
      regionProvided: false,
      hostProvided: true,
    });
    assert.deepStrictEqual(payload, {
      account_provided: 'true',
      account_with_region: 'false',
      account_org_provided: 'true',
      region_provided: 'false',
      host_provided: 'true',
    });
  });

  it('emits "false" for an all-false shape', () => {
    const payload = shapeToTelemetryPayload({
      accountProvided: false,
      accountWithRegion: false,
      accountOrgProvided: false,
      regionProvided: false,
      hostProvided: false,
    });
    assert.deepStrictEqual(payload, {
      account_provided: 'false',
      account_with_region: 'false',
      account_org_provided: 'false',
      region_provided: 'false',
      host_provided: 'false',
    });
  });

  it('emits exactly the five wire-format keys (no sixth `access_url_provided`)', () => {
    const payload = shapeToTelemetryPayload(recordInputShape({}));
    assert.deepStrictEqual(Object.keys(payload).sort(), [
      'account_org_provided',
      'account_provided',
      'account_with_region',
      'host_provided',
      'region_provided',
    ]);
  });
});
