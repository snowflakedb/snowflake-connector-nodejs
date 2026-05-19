import assert from 'node:assert';
import {
  buildInbandTelemetryRequest,
  CLIENT_CONNECTION_IDENTIFIER_SHAPE,
  DISABLE_CONNECTION_SHAPE_ENV,
  isConnectionShapeTelemetryDisabledByEnv,
} from '../../../lib/telemetry/inband_telemetry';
import {
  recordInputShape,
  shapeToTelemetryPayload,
} from '../../../lib/connection/connection_identifier_shape';

// Minimal stub matching `WIP_ConnectionConfig` for the surface
// `buildInbandTelemetryRequest` actually reads.
const fakeConnectionConfig: any = {
  getClientType: () => 'JavaScript',
  getClientVersion: () => '99.99.99',
  getClientApplication: () => 'unit-test',
};

describe('client_connection_identifier_shape constants', () => {
  it('event-type constant matches the exact wire-format type string', () => {
    // This is byte-identical across drivers — do not change without
    // coordinating with Go (PR snowflakedb/gosnowflake#1797), Python
    // (PR snowflakedb/snowflake-connector-python#2877), and JDBC.
    assert.strictEqual(CLIENT_CONNECTION_IDENTIFIER_SHAPE, 'client_connection_identifier_shape');
  });

  it('env-switch name matches the exact cross-driver kill-switch name', () => {
    assert.strictEqual(DISABLE_CONNECTION_SHAPE_ENV, 'SF_TELEMETRY_DISABLE_CONNECTION_SHAPE');
  });
});

describe('isConnectionShapeTelemetryDisabledByEnv', () => {
  const truthyValues = ['true', 'TRUE', 'True', 'tRuE'];
  const ignoredValues = ['1', 'yes', 'on', 'enabled', 'TRUTHY', 'false', '0', 'no', '', '  '];

  for (const value of truthyValues) {
    it(`treats ${JSON.stringify(value)} as kill-switch engaged (case-insensitive "true")`, () => {
      assert.strictEqual(
        isConnectionShapeTelemetryDisabledByEnv({
          [DISABLE_CONNECTION_SHAPE_ENV]: value,
        }),
        true,
      );
    });
  }

  for (const value of ignoredValues) {
    it(`leaves emission enabled for ${JSON.stringify(value)} (no truthy aliases)`, () => {
      assert.strictEqual(
        isConnectionShapeTelemetryDisabledByEnv({
          [DISABLE_CONNECTION_SHAPE_ENV]: value,
        }),
        false,
      );
    });
  }

  it('leaves emission enabled when the env var is unset', () => {
    assert.strictEqual(isConnectionShapeTelemetryDisabledByEnv({}), false);
  });

  it('leaves emission enabled when the env var is undefined', () => {
    assert.strictEqual(
      isConnectionShapeTelemetryDisabledByEnv({
        [DISABLE_CONNECTION_SHAPE_ENV]: undefined,
      }),
      false,
    );
  });
});

describe('buildInbandTelemetryRequest with client_connection_identifier_shape payload', () => {
  it('builds a /telemetry/send POST whose message.value carries the five stringified-boolean keys', () => {
    const shape = recordInputShape({ account: 'myorg-myacct.us-east-1' });
    const payload = shapeToTelemetryPayload(shape);

    const req = buildInbandTelemetryRequest(
      fakeConnectionConfig,
      CLIENT_CONNECTION_IDENTIFIER_SHAPE,
      payload,
    );

    assert.strictEqual(req.method, 'POST');
    assert.strictEqual(req.url, '/telemetry/send');

    const log = req.json.logs[0];
    assert.strictEqual(typeof log.timestamp, 'number');
    assert.strictEqual(log.message.type, 'client_connection_identifier_shape');
    assert.strictEqual(log.message.driver_type, 'JavaScript');
    assert.strictEqual(log.message.driver_version, '99.99.99');
    assert.strictEqual(log.message.source, 'unit-test');

    // Wire-format payload nested under `message.value` per the existing
    // `buildInbandTelemetryRequest` envelope (Node.js is the only driver
    // of the four that nests; that's a pre-existing server-side concern,
    // not something to fix from the client side).
    assert.deepStrictEqual(log.message.value, {
      account_provided: 'true',
      account_with_region: 'true',
      account_org_provided: 'true',
      region_provided: 'false',
      host_provided: 'false',
    });
  });

  it('falls back to driver type for source when application is unset', () => {
    const cfg: any = {
      getClientType: () => 'JavaScript',
      getClientVersion: () => '0.0.0',
      getClientApplication: () => undefined,
    };
    const req = buildInbandTelemetryRequest(cfg, CLIENT_CONNECTION_IDENTIFIER_SHAPE, {});
    assert.strictEqual(req.json.logs[0].message.source, 'JavaScript');
  });

  it('preserves the all-false shape end-to-end', () => {
    const payload = shapeToTelemetryPayload(recordInputShape({}));
    const req = buildInbandTelemetryRequest(
      fakeConnectionConfig,
      CLIENT_CONNECTION_IDENTIFIER_SHAPE,
      payload,
    );
    assert.deepStrictEqual(req.json.logs[0].message.value, {
      account_provided: 'false',
      account_with_region: 'false',
      account_org_provided: 'false',
      region_provided: 'false',
      host_provided: 'false',
    });
  });
});
