// NOTE:
// Intentionally not an enum as we want users to pass strings
export const WorkloadIdentityProvider = {
  AWS: 'AWS',
  AZURE: 'AZURE',
  GCP: 'GCP',
  // OIDC: 'OIDC'
} as const;

export type WorkloadIdentityProviderKey = keyof typeof WorkloadIdentityProvider;
