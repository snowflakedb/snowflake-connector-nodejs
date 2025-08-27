import { Agent, AgentOptions } from 'https';
import { TLSSocket } from 'tls';
import { corkSocketAndValidateCrl, CRLValidatorConfig } from './crl_validator';

interface HttpsCrlAgentOptions extends AgentOptions {
  crlValidatorConfig: CRLValidatorConfig;
}

// TODO: when OCSP is removed, rename to HttpsAgent
export default class HttpsCrlAgent extends Agent {
  private crlValidatorConfig: CRLValidatorConfig;

  constructor(opts: HttpsCrlAgentOptions) {
    const { crlValidatorConfig, ...agentOptions } = opts;
    super(agentOptions);
    this.crlValidatorConfig = crlValidatorConfig;
  }

  createConnection(...args: any[]) {
    const createConnection = (Agent.prototype as any).createConnection as (
      ...args: any[]
    ) => TLSSocket;
    const socket = createConnection.apply(this, args);
    corkSocketAndValidateCrl(socket, this.crlValidatorConfig);
    return socket;
  }
}
