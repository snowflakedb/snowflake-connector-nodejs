import { WIP_ConnectionConfig } from '../connection/types';

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
