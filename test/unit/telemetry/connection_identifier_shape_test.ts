import assert from 'node:assert';
import {
  buildConnectionShapePayload,
  ConnectionShapePayload,
} from '../../../lib/telemetry/connection_identifier_shape';
import type { WIP_ConnectionOptions } from '../../../lib/connection/types';

interface ShapeCase {
  name: string;
  options: WIP_ConnectionOptions;
  expected: ConnectionShapePayload;
}

const cases: ShapeCase[] = [
  {
    name: 'bare account flips only account_provided',
    options: { account: 'myacct' },
    expected: {
      account_provided: 'true',
      account_with_region: 'false',
      account_org_provided: 'false',
      region_provided: 'false',
      host_provided: 'false',
    },
  },
  {
    name: 'dotted account flips account_with_region (deprecated account.region form)',
    options: { account: 'myacct.us-east-1' },
    expected: {
      account_provided: 'true',
      account_with_region: 'true',
      account_org_provided: 'false',
      region_provided: 'false',
      host_provided: 'false',
    },
  },
  {
    name: 'org-prefixed account flips account_org_provided',
    options: { account: 'myorg-myacct' },
    expected: {
      account_provided: 'true',
      account_with_region: 'false',
      account_org_provided: 'true',
      region_provided: 'false',
      host_provided: 'false',
    },
  },
  {
    name: 'org-prefix + dotted account flips both account_with_region and account_org_provided',
    options: { account: 'myorg-myacct.us-east-1' },
    expected: {
      account_provided: 'true',
      account_with_region: 'true',
      account_org_provided: 'true',
      region_provided: 'false',
      host_provided: 'false',
    },
  },
  {
    // The "-east-" dashes live in the region portion, not the account portion.
    name: 'region-tail dashes do NOT count toward account_org_provided',
    options: { account: 'myacct.us-east-1' },
    expected: {
      account_provided: 'true',
      account_with_region: 'true',
      account_org_provided: 'false',
      region_provided: 'false',
      host_provided: 'false',
    },
  },
  {
    // `.global` stripping happens during normalization, after capture.
    name: '.global URL with org prefix still counted (capture is on raw input)',
    options: { account: 'myorg-myacct.us-west-2.global' },
    expected: {
      account_provided: 'true',
      account_with_region: 'true',
      account_org_provided: 'true',
      region_provided: 'false',
      host_provided: 'false',
    },
  },
  {
    name: 'region kwarg flips region_provided',
    options: { region: 'us-east-1' },
    expected: {
      account_provided: 'false',
      account_with_region: 'false',
      account_org_provided: 'false',
      region_provided: 'true',
      host_provided: 'false',
    },
  },
  {
    name: 'host only flips host_provided',
    options: { host: 'myacct.snowflakecomputing.com' },
    expected: {
      account_provided: 'false',
      account_with_region: 'false',
      account_org_provided: 'false',
      region_provided: 'false',
      host_provided: 'true',
    },
  },
  {
    name: 'accessUrl only flips host_provided (Node.js-specific dimension)',
    options: { accessUrl: 'https://myacct.snowflakecomputing.com:443' },
    expected: {
      account_provided: 'false',
      account_with_region: 'false',
      account_org_provided: 'false',
      region_provided: 'false',
      host_provided: 'true',
    },
  },
  {
    name: 'host + accessUrl both set still flips host_provided exactly once',
    options: {
      host: 'myacct.snowflakecomputing.com',
      accessUrl: 'https://myacct.snowflakecomputing.com',
    },
    expected: {
      account_provided: 'false',
      account_with_region: 'false',
      account_org_provided: 'false',
      region_provided: 'false',
      host_provided: 'true',
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
      account_provided: 'true',
      account_with_region: 'true',
      account_org_provided: 'true',
      region_provided: 'true',
      host_provided: 'true',
    },
  },
  {
    name: 'empty-string account is not user-supplied',
    options: { account: '' },
    expected: {
      account_provided: 'false',
      account_with_region: 'false',
      account_org_provided: 'false',
      region_provided: 'false',
      host_provided: 'false',
    },
  },
  {
    // Pathological input: gosnowflake's `recordAccountShape` gates the
    // dot-split on `i > 0`, so a leading dot leaves the full string as
    // the account portion and the dash search runs over the whole value.
    name: 'leading-dot account does not split — dash search runs over the full raw value',
    options: { account: '.us-east-1' },
    expected: {
      account_provided: 'true',
      account_with_region: 'false',
      account_org_provided: 'true',
      region_provided: 'false',
      host_provided: 'false',
    },
  },
  {
    name: 'empty options object returns all-false payload',
    options: {},
    expected: {
      account_provided: 'false',
      account_with_region: 'false',
      account_org_provided: 'false',
      region_provided: 'false',
      host_provided: 'false',
    },
  },
];

describe('buildConnectionShapePayload', () => {
  for (const tc of cases) {
    it(tc.name, () => {
      assert.deepStrictEqual(buildConnectionShapePayload(tc.options as any), tc.expected);
    });
  }
});
