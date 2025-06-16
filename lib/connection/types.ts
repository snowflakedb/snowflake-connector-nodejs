import { WorkloadIdentityProviderKey } from "../authentication/auth_workload_identity/types";

/**
 * Work In Progress typing for ConnectionConfig instance
 */
export interface WIP_ConnectionConfig {
  enableExperimentalWorkloadIdentityAuth?: boolean;
  workloadIdentity?: {
    /**
     * Specifies the workload identity provider
     */
    provider?: WorkloadIdentityProviderKey;
    /**
     * Customize Azure Entra Id Resource used to obrain auth token
     */
    azureEntraIdResource?: string;
  }
}
