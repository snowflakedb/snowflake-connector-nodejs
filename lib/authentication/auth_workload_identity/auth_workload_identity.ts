import { AuthClass, AuthRequestBody } from "../types";
import { getAwsAttestationToken } from "./attestation_aws";
import { WorkloadIdentityProvider, WorkloadIdentityProviderKey } from "./types";
import { createInvalidParameterError, ErrorCode } from '../../errors';
import { WIP_ConnectionConfig } from "../../connection/types";
import Logger from '../../logger';
import { getAzureAttestationToken } from "./attestation_azure";
import { getGcpAttestationToken } from "./attestation_gcp";
import AuthenticationTypes from "../authentication_types";

class AuthWorkloadIdentity implements AuthClass {
  tokenProvider!: WorkloadIdentityProviderKey;
  token!: string;

  constructor(private connectionConfig: WIP_ConnectionConfig) {
    if (process.env.SF_ENABLE_EXPERIMENTAL_AUTHENTICATION !== 'true') {
      throw new Error('Experimental Workload identity authentication is not enabled. Please set env var SF_ENABLE_EXPERIMENTAL_AUTHENTICATION=true to use this authenticator.');
    }
  }

  async autodetectToken(): Promise<{ provider: WorkloadIdentityProviderKey, token: string } | null> {
    const oidcToken = this.connectionConfig.token;
    if (oidcToken) {
      return { provider: WorkloadIdentityProvider.OIDC, token: oidcToken };
    }

    const awsCredentials = await getAwsAttestationToken();
    if (awsCredentials) {
      return { provider: WorkloadIdentityProvider.AWS, token: awsCredentials };
    }

    const azureToken = await getAzureAttestationToken(this.connectionConfig.workloadIdentityAzureEntraIdResource);
    if (azureToken) {
      return { provider: WorkloadIdentityProvider.AZURE, token: azureToken };
    }

    const gcpToken = await getGcpAttestationToken();
    if (gcpToken) {
      return { provider: WorkloadIdentityProvider.GCP, token: gcpToken };
    }

    return null;
  }

  updateBody(body: AuthRequestBody) {
    body.data['AUTHENTICATOR'] = AuthenticationTypes.WORKLOAD_IDENTITY;
    body.data['PROVIDER'] = this.tokenProvider;
    body.data['TOKEN'] = this.token;
  }

  async authenticate() {
    let provider = this.connectionConfig.workloadIdentityProvider;
    let token: string | null = null;

    if (provider === WorkloadIdentityProvider.AWS) {
      token = await getAwsAttestationToken();
    } else if (provider === WorkloadIdentityProvider.AZURE) {
      token = await getAzureAttestationToken(this.connectionConfig.workloadIdentityAzureEntraIdResource);
    } else if (provider === WorkloadIdentityProvider.GCP) {
      token = await getGcpAttestationToken();
    } else if (provider === WorkloadIdentityProvider.OIDC) {
      token = this.connectionConfig.token ?? null;
    } else {
      const detectedCredentials = await this.autodetectToken();
      if (detectedCredentials) {
        provider = detectedCredentials.provider;
        token = detectedCredentials.token;
      }
    }

    if (!token || !provider) {
      throw createInvalidParameterError(
        ErrorCode.ERR_CONN_CREATE_MISSING_WORKLOAD_IDENTITY_CREDENTIALS,
        provider ?? 'auto-detect'
      );
    } else {
      Logger().debug(`AuthWorkloadIdentity using provider=${provider}`);
      this.tokenProvider = provider;
      this.token = token;
    }
  }

  async reauthenticate(body: AuthRequestBody) {
    await this.authenticate();
    this.updateBody(body);
  }
}

export default AuthWorkloadIdentity;
