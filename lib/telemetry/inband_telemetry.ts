import { WIP_ConnectionConfig } from '../connection/types';

/**
 * Telemetry event type emitted once per successful login describing which
 * connection-identifier fields the user supplied. Colocated here next to
 * `buildInbandTelemetryRequest` to mirror how Go and Python keep the
 * event-type constant next to the envelope builder.
 *
 * TODO(SNOW-3548350): remove with the telemetry emission
 * (target: 2026-11-30).
 */
export const CLIENT_CONNECTION_IDENTIFIER_SHAPE = 'client_connection_identifier_shape';

/**
 * Local kill switch for the `client_connection_identifier_shape` event.
 * Match semantics across drivers: case-insensitive `"true"` only — no
 * `1` / `yes` / etc. aliases.
 *
 * TODO(SNOW-3548350): remove with the telemetry emission
 * (target: 2026-11-30).
 */
export const DISABLE_CONNECTION_SHAPE_ENV = 'SF_TELEMETRY_DISABLE_CONNECTION_SHAPE';

/**
 * Returns true when the local kill switch for the
 * `client_connection_identifier_shape` event is engaged. Matches the Go /
 * Python / JDBC semantics: case-insensitive `"true"` only.
 *
 * TODO(SNOW-3548350): remove with the telemetry emission
 * (target: 2026-11-30).
 */
export function isConnectionShapeTelemetryDisabledByEnv(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return String(env[DISABLE_CONNECTION_SHAPE_ENV] ?? '').toLowerCase() === 'true';
}

export function buildInbandTelemetryRequest(
  connectionConfig: WIP_ConnectionConfig,
  eventType: string,
  eventData: any,
) {
  return {
    method: 'POST',
    url: '/telemetry/send',
    json: {
      logs: [
        {
          timestamp: new Date().getTime(),
          message: {
            driver_type: connectionConfig.getClientType(),
            driver_version: connectionConfig.getClientVersion(),
            source: connectionConfig.getClientApplication() ?? connectionConfig.getClientType(),
            type: eventType,
            value: eventData,
          },
        },
      ],
    },
  };
}
