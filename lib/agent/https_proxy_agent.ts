import * as tls from 'tls';
import * as http from 'http';
import { URL } from 'url';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { AgentConnectOpts } from 'agent-base';
import {
  CRLValidatorConfig,
  isCrlValidationEnabled,
  corkSocketAndValidateCrl,
} from './crl_validator';
import SocketUtil from './socket_util';
import ProxyUtil from '../proxy_util';
import Logger from '../logger';

export type SnowflakeHttpsProxyAgentOptions = AgentConnectOpts & {
  crlValidatorConfig: CRLValidatorConfig;
  host: string;
  port: string;
  protocol: string;
  useForOCSP: boolean;
  user?: string;
  password?: string;
};

class SnowflakeHttpsProxyAgent extends HttpsProxyAgent<string> {
  private useForOCSP: boolean;
  private crlValidatorConfig: CRLValidatorConfig;

  constructor(opts: SnowflakeHttpsProxyAgentOptions) {
    const {
      host,
      port,
      user,
      password,
      protocol: rawProtocol,
      useForOCSP,
      crlValidatorConfig,
      ...agentOptions
    } = opts;
    const protocol = rawProtocol.endsWith(':') ? rawProtocol : `${rawProtocol}:`;
    const proxyUrl = new URL(`${protocol}//${host}:${port}`);
    proxyUrl.username = user ?? '';
    proxyUrl.password = password ?? '';
    super(proxyUrl, agentOptions);
    this.useForOCSP = useForOCSP;
    this.crlValidatorConfig = crlValidatorConfig;
  }

  async connect(req: http.ClientRequest, opts: AgentConnectOpts) {
    Logger().debug('Using proxy=%s for host %s', this.proxy.hostname, opts.host);
    const socket = await super.connect(req, opts);
    if (socket instanceof tls.TLSSocket) {
      if (isCrlValidationEnabled(this.crlValidatorConfig)) {
        corkSocketAndValidateCrl(socket, this.crlValidatorConfig);
      } else {
        const isProxyRequiredForOCSP =
          this.useForOCSP &&
          !ProxyUtil.isByPassProxy(this.proxy, SocketUtil.REGEX_SNOWFLAKE_ENDPOINT);
        SocketUtil.secureSocket(socket, this.proxy.hostname, isProxyRequiredForOCSP ? this : null);
      }
    }
    return socket;
  }
}

module.exports = SnowflakeHttpsProxyAgent;
