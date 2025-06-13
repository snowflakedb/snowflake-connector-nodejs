import { AuthClass, AuthRequestBody } from "../types";
import { getAwsAttestationToken } from "./attestation_aws";
import { WorkloadIdentityProvider } from "./types";
import { createInvalidParameterError, ErrorCode } from '../../errors';
import { WIP_ConnectionConfig } from "../../connection/types";

class AuthWorkloadIdentity implements AuthClass {
  connectionConfig: WIP_ConnectionConfig;
  tokenProvider?: WorkloadIdentityProvider;
  token?: string;

  constructor(connectionConfig: WIP_ConnectionConfig) {
    if (!connectionConfig.enableExperimentalWorkloadIdentityAuth) {
      throw new Error('Experimental Workload identity authentication is not enabled. Please set enableExperimentalWorkloadIdentityAuth to true to use this authenticator.');
    }
    // NOTE:
    // Check will be removed when auto-detection is implemented
    if (connectionConfig.workloadIdentityProvider !== WorkloadIdentityProvider.AWS) {
      throw new Error(`Experimental authenticator: 'WORKLOAD_IDENTITY' requires workloadIdentityProvider: 'AWS'`);
    }
    this.connectionConfig = connectionConfig;
  }

  updateBody(body: AuthRequestBody) {
    body.data['AUTHENTICATOR'] = 'WORKLOAD_IDENTITY';
    body.data['PROVIDER'] = this.tokenProvider;
    body.data['TOKEN'] = this.token;
  }

  async authenticate() {
    const provider = this.connectionConfig.workloadIdentityProvider;
    let token: string | null = null;

    if (provider === WorkloadIdentityProvider.AWS) {
      token = await getAwsAttestationToken();
    }

    if (!token) {
      throw createInvalidParameterError(
        ErrorCode.ERR_CONN_CREATE_MISSING_WORKLOAD_IDENTITY_CREDENTIALS,
        provider
      );
    } else {
      // NOTE:
      // "as WorkloadIdentityProvider" is temporary while no auto-detection is implemented
      this.tokenProvider = provider as WorkloadIdentityProvider;
      this.token = token;
    }
  }

  async reauthenticate(_body: AuthRequestBody) {
    throw new Error('TODO: Not implemented');
  }
}

export default AuthWorkloadIdentity;
