import * as http from 'http';
import * as https from 'https';
import { WIP_ConnectionConfig } from '../connection/types';
import { getProxyAgent as getProxyAgentUntyped } from './node_untyped';

export { NodeHttpClient, getAgentCacheSize, isBypassProxy } from './node_untyped';

/**
 * Work In Progress TypeScript migration for http/node_untyped.js
 */
export function getProxyAgent(config: {
  proxyOptions: ReturnType<WIP_ConnectionConfig['getProxy']>;
  connectionConfig: WIP_ConnectionConfig;
  parsedUrl: URL;
  destination: string;
  mockAgent?: http.Agent | https.Agent;
}) {
  const { proxyOptions, connectionConfig, parsedUrl, destination, mockAgent } = config;
  return getProxyAgentUntyped(proxyOptions, parsedUrl, destination, mockAgent, connectionConfig);
}
