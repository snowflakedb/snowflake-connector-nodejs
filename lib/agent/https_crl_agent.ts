import { Agent, AgentOptions } from 'https';
import { TLSSocket } from 'tls';
import { validateCrl, CRLConfig } from './crl_validator';

interface HttpsCrlAgentOptions extends AgentOptions {
  crlConfig: CRLConfig;
}

// TODO: when OCSP is removed, rename to HttpsAgent
export default class HttpsCrlAgent extends Agent {
  private crlConfig: CRLConfig;

  constructor(opts: HttpsCrlAgentOptions) {
    const { crlConfig, ...agentOptions } = opts;
    super(agentOptions);
    this.crlConfig = crlConfig;
  }

  createConnection(...args: any[]) {
    const createConnection = (Agent.prototype as any).createConnection as (
      ...args: any[]
    ) => TLSSocket;
    const socket = createConnection.apply(this, args);
    validateCrl(socket, this.crlConfig);
    return socket;
  }
}
