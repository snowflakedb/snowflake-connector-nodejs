import { WorkloadIdentityProviderKey } from "../authentication/auth_workload_identity/types";

/**
 * Work In Progress typing for ConnectionConfig instance
 */
export interface WIP_ConnectionConfig {
  enableExperimentalWorkloadIdentityAuth?: boolean;
  token?: string;
  workloadIdentity?: {
    /**
     * Specifies the workload identity provider, available options:
     * * AWS - Uses `@aws-sdk` to find credentials and encodes signed GetCallerIdentity request as token
     * * AZURE - Uses `@azure/identity` find credentials and get JWT token
     * * GCP - Uses `google-auth-library` to find credentials and get JWT token
     * * OIDC - Reads JWT token from `ConnectionOptions.token`
     *
     * When none is passed, the driver will try to auto-detect the provider.
     */
    provider?: WorkloadIdentityProviderKey;
    /**
     * Customize Azure Entra Id Resource used to obrain auth token
     */
    azureEntraIdResource?: string;
  }
}
