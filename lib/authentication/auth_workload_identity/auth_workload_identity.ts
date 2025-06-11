import { AuthClass, AuthRequestBody } from "../types";
import { getAwsAttestationToken } from "./attestation_aws";
import { WorkloadIdentityProvider } from "./types";
import { createInvalidParameterError, ErrorCode } from '../../errors';
import { WIP_ConnectionConfig } from "../../connection/types";

class AuthWorkloadIdentity implements AuthClass {
  connectionConfig: WIP_ConnectionConfig;

  constructor(connectionConfig: WIP_ConnectionConfig) {
    this.connectionConfig = connectionConfig;
  }

  async getAttestation() {
    const provider = this.connectionConfig.workloadIdentityProvider;
    let token: string | null = null;

    if (provider === WorkloadIdentityProvider.AWS) {
      token = await getAwsAttestationToken();
    } else {
      throw new Error(`Experimental authenticator: 'WORKLOAD_IDENTITY' requires workloadIdentityProvider: 'AWS'`);
    }

    if (!token) {
      throw createInvalidParameterError(
        ErrorCode.ERR_CONN_CREATE_MISSING_WORKLOAD_IDENTITY_CREDENTIALS,
        `No workload identity credential was found for: ${provider}`
      );
    } else {
      return {
        provider,
        token,
      };
    }
  }

  async updateBody(body: AuthRequestBody) {
    const { provider, token } = await this.getAttestation();
    body.data['AUTHENTICATOR'] = 'WORKLOAD_IDENTITY';
    body.data['PROVIDER'] = provider;
    body.data['TOKEN'] = token;
  }

  async authenticate() {}

  async reauthenticate() {}
}

export default AuthWorkloadIdentity;
