import { AuthClass, AuthRequestBody } from '../types';
import { getAwsAttestationToken } from './attestation_aws';
import { WorkloadIdentityProvider, WorkloadIdentityProviderKey } from './types';
import { createInvalidParameterError, ErrorCode } from '../../errors';
import { WIP_ConnectionConfig } from '../../connection/types';
import Logger from '../../logger';
import { getAzureAttestationToken } from './attestation_azure';
import { getGcpAttestationToken } from './attestation_gcp';
import AuthenticationTypes from '../authentication_types';

class AuthWorkloadIdentity implements AuthClass {
  tokenProvider!: WorkloadIdentityProviderKey;
  token!: string;

  constructor(private connectionConfig: WIP_ConnectionConfig) {}

  updateBody(body: AuthRequestBody) {
    body.data['AUTHENTICATOR'] = AuthenticationTypes.WORKLOAD_IDENTITY;
    body.data['PROVIDER'] = this.tokenProvider;
    body.data['TOKEN'] = this.token;
  }

  async authenticate() {
    const {
      workloadIdentityProvider: provider,
      workloadIdentityImpersonationPath: impersonationPath,
    } = this.connectionConfig;
    let token: string;

    if (impersonationPath && provider === WorkloadIdentityProvider.AZURE) {
      throw new Error(`workloadIdentityImpersonationPath for ${provider} not supported yet`);
    }

    if (provider === WorkloadIdentityProvider.AWS) {
      token = await getAwsAttestationToken(impersonationPath);
    } else if (provider === WorkloadIdentityProvider.AZURE) {
      token = await getAzureAttestationToken({
        managedIdentityClientId: this.connectionConfig.workloadIdentityAzureClientId,
        entraIdResource: this.connectionConfig.workloadIdentityAzureEntraIdResource,
      });
    } else if (provider === WorkloadIdentityProvider.GCP) {
      token = await getGcpAttestationToken();
    } else if (provider === WorkloadIdentityProvider.OIDC) {
      if (this.connectionConfig.token) {
        token = this.connectionConfig.token;
      } else {
        throw createInvalidParameterError(
          ErrorCode.ERR_CONN_CREATE_INVALID_WORKLOAD_IDENTITY_PARAMETERS,
          `workloadIdentityProvider: OIDC requires token in connection options`,
        );
      }
    } else {
      throw createInvalidParameterError(
        ErrorCode.ERR_CONN_CREATE_INVALID_WORKLOAD_IDENTITY_PARAMETERS,
        `workloadIdentityProvider must be one of: ${Object.values(WorkloadIdentityProvider).join(', ')}`,
      );
    }

    Logger().debug(`AuthWorkloadIdentity using provider=${provider}`);
    this.tokenProvider = provider;
    this.token = token;
  }
}

export default AuthWorkloadIdentity;
