import { WorkloadIdentityProviderKey } from "../authentication/auth_workload_identity/types";

/**
 * Work In Progress typing for ConnectionConfig instance
 */
export interface WIP_ConnectionConfig {
  /**
   * Enable single use refresh tokens for OAuth
   */
  oauthEnableSingleUseRefreshTokens?: boolean;

  enableExperimentalWorkloadIdentityAuth?: boolean;

  /**
   * Customization options for "authentication: WORKLOAD_IDENTITY"
   *
   * This option is experimental and requires enableExperimentalWorkloadIdentityAuth to be enabled.
   * The API may change in future versions.
   */
  workloadIdentity?: {
    /**
     * Specifies the workload identity provider
     */
    provider?: WorkloadIdentityProviderKey;
    /**
     * Customize Azure Entra Id Resource used to obtain auth token
     */
    azureEntraIdResource?: string;
  }
}
