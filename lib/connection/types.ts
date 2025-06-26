import { WorkloadIdentityProviderKey } from "../authentication/auth_workload_identity/types";

/**
 * Work In Progress typing for ConnectionOptions
 */
export interface WIP_ConnectionOptions {
  /**
   * Specifies the authenticator to use for verifying user login credentials.
   *
   * Available options:
   * * `SNOWFLAKE` - Default authenticator that uses basic username/password authentication
   * * `EXTERNALBROWSER` - Browser-based SSO authentication through your identity provider
   * * `SNOWFLAKE_JWT` - Key pair authentication using a private key and public key pair
   * * `OAUTH` - OAuth authentication using a token obtained from OAuth flow
   * * `USERNAME_PASSWORD_MFA` - Username/password with multi-factor authentication
   * * `ID_TOKEN` - ID token-based authentication
   * * `PROGRAMMATIC_ACCESS_TOKEN` - Authentication using a programmatic access token
   * * `OAUTH_AUTHORIZATION_CODE` - OAuth authorization code flow for web applications
   * * `OAUTH_CLIENT_CREDENTIALS` - OAuth client credentials flow for service-to-service auth
   * * `WORKLOAD_IDENTITY` - Workload identity authentication for cloud providers
   * * `https://<okta_account_name>.okta.com` - Native SSO authentication through Okta
   */
  authenticator?: string;

  /**
   * Specifies the token to use for authentication. Set this option if you set the authenticator option to
   * * OAUTH
   * * PROGRAMMATIC_ACCESS_TOKEN
   * * WORKLOAD_IDENTITY
   */
  token?: string;

  /**
   * Enable single use refresh tokens for OAuth
   */
  oauthEnableSingleUseRefreshTokens?: boolean;

  /**
   * When authenticator=WORKLOAD_IDENTITY, specifies the identity provider. Available options:
   * * AWS - Uses `@aws-sdk` to find credentials and encodes signed GetCallerIdentity request as token
   * * AZURE - Uses `@azure/identity` to find credentials and get JWT token
   * * GCP - Uses `google-auth-library` to find credentials and get JWT token
   * * OIDC - Reads JWT token from `ConnectionOptions.token`
   *
   * When none is passed, the driver will try to auto-detect the provider.
   */
  workloadIdentityProvider?: WorkloadIdentityProviderKey;

  /**
   * Customize Azure Entra Id Resource used to obtain workload identity auth token
   */
  workloadIdentityAzureEntraIdResource?: string;
}

/**
 * Work In Progress typing for ConnectionConfig instance
 */
export type WIP_ConnectionConfig = {
  // NOTE:
  // Temporary explicit mapping as at some point we'll have options that aren't present on
  // ConnectionConfig instance e.g. instead of oauthClientId we have getOauthClientId().
  //
  // Future plan is to remove this type and let TypeScript to infer types automatically from
  // ConnectionConfig code.
  token: WIP_ConnectionOptions['token'];
  workloadIdentityProvider: WIP_ConnectionOptions['workloadIdentityProvider'];
  workloadIdentityAzureEntraIdResource: WIP_ConnectionOptions['workloadIdentityAzureEntraIdResource'];
  oauthEnableSingleUseRefreshTokens: WIP_ConnectionOptions['oauthEnableSingleUseRefreshTokens'];

  getOauthHttpAllowed(): boolean;
  getOauthClientId(): string;
  getOauthClientSecret(): string;
}
