import { AuthClass, AuthRequestBody } from "../types";
import { getAwsAttestationToken } from "./attestation_aws";
import { WorkloadIdentityProvider, WorkloadIdentityProviderKey } from "./types";
import { createInvalidParameterError, ErrorCode } from '../../errors';
import { WIP_ConnectionConfig } from "../../connection/types";
import { getAzureAttestationToken } from "./attestation_azure";

class AuthWorkloadIdentity implements AuthClass {
  connectionConfig: WIP_ConnectionConfig;
  tokenProvider?: WorkloadIdentityProviderKey;
  token?: string;

  constructor(connectionConfig: WIP_ConnectionConfig) {
    if (!connectionConfig.enableExperimentalWorkloadIdentityAuth) {
      throw new Error('Experimental Workload identity authentication is not enabled. Please set enableExperimentalWorkloadIdentityAuth to true to use this authenticator.');
    }
    this.connectionConfig = connectionConfig;
  }

  updateBody(body: AuthRequestBody) {
    body.data['AUTHENTICATOR'] = 'WORKLOAD_IDENTITY';
    body.data['PROVIDER'] = this.tokenProvider;
    body.data['TOKEN'] = this.token;
  }

  async authenticate() {
    const { provider, azureEntraIdResource } = this.connectionConfig.workloadIdentity ?? {};
    let token: string | null = null;

    if (provider === WorkloadIdentityProvider.AWS) {
      token = await getAwsAttestationToken();
    } else if (provider === WorkloadIdentityProvider.AZURE) {
      token = await getAzureAttestationToken(azureEntraIdResource);
    } else {
      throw new Error(`Experimental authenticator: 'WORKLOAD_IDENTITY' requires workloadIdentity.provider: ${Object.values(WorkloadIdentityProvider).join('|')}`);
    }

    if (!token) {
      throw createInvalidParameterError(
        ErrorCode.ERR_CONN_CREATE_MISSING_WORKLOAD_IDENTITY_CREDENTIALS,
        provider
      );
    } else {
      this.tokenProvider = provider;
      this.token = token;
    }
  }

  async reauthenticate(_body: AuthRequestBody) {
    throw new Error('TODO: Not implemented');
  }
}

export default AuthWorkloadIdentity;
