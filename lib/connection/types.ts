import { WorkloadIdentityProvider } from "../authentication/auth_workload_identity/types";

/**
 * Work In Progress typing for ConnectionConfig instance
 */
export interface WIP_ConnectionConfig {
  enableExperimentalWorkloadIdentityAuth?: boolean;
  workloadIdentityProvider?: keyof typeof WorkloadIdentityProvider;
}
