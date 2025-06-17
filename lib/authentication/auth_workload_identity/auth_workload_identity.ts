import { AuthClass, AuthRequestBody } from "../types";
import { getAwsAttestationToken } from "./attestation_aws";
import { WorkloadIdentityProvider, WorkloadIdentityProviderKey } from "./types";
import { createInvalidParameterError, ErrorCode } from '../../errors';
import { WIP_ConnectionConfig } from "../../connection/types";
import Logger from '../../logger';
import { getAzureAttestationToken } from "./attestation_azure";
import { getGcpAttestationToken } from "./attestation_gcp";

class AuthWorkloadIdentity implements AuthClass {
  connectionConfig: WIP_ConnectionConfig;
  tokenProvider!: WorkloadIdentityProviderKey;
  token!: string;

  constructor(connectionConfig: WIP_ConnectionConfig) {
    if (!connectionConfig.enableExperimentalWorkloadIdentityAuth) {
      throw new Error('Experimental Workload identity authentication is not enabled. Please set enableExperimentalWorkloadIdentityAuth to true to use this authenticator.');
    }
    this.connectionConfig = connectionConfig;
  }

  async autodetectToken(): Promise<{ provider: WorkloadIdentityProviderKey, token: string } | null> {
    const getProviderCredentials = (
      provider: WorkloadIdentityProviderKey,
      getTokenPromise: Promise<string | null>
    ) => getTokenPromise.then(token => token ? {
      provider,
      token
    } : Promise.reject());

    const credentials = await Promise.any([
      getProviderCredentials(
        WorkloadIdentityProvider.OIDC,
        Promise.resolve(this.connectionConfig.token ?? null)
      ),
      getProviderCredentials(
        WorkloadIdentityProvider.AWS,
        getAwsAttestationToken()
      ),
      getProviderCredentials(
        WorkloadIdentityProvider.AZURE,
        getAzureAttestationToken(this.connectionConfig.workloadIdentity?.azureEntraIdResource)
      ),
      getProviderCredentials(
        WorkloadIdentityProvider.GCP,
        getGcpAttestationToken()
      )
    ]).catch(() => null);

    return credentials ?? null;
  }

  updateBody(body: AuthRequestBody) {
    body.data['AUTHENTICATOR'] = 'WORKLOAD_IDENTITY';
    body.data['PROVIDER'] = this.tokenProvider;
    body.data['TOKEN'] = this.token;
  }

  async authenticate() {
    let provider = this.connectionConfig.workloadIdentity?.provider;
    let token: string | null = null;

    if (provider === WorkloadIdentityProvider.AWS) {
      token = await getAwsAttestationToken();
    } else if (provider === WorkloadIdentityProvider.AZURE) {
      token = await getAzureAttestationToken(this.connectionConfig.workloadIdentity?.azureEntraIdResource);
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
