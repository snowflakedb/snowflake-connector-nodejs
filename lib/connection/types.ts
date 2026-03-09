import { WorkloadIdentityProviderKey } from '../authentication/auth_workload_identity/types';
import { CRLValidatorConfig } from '../agent/crl_validator';

/**
 * Work In Progress typing for ConnectionOptions
 */
export interface WIP_ConnectionOptions {
  /**
   * Your account identifier.
   */
  account: string;

  /**
   * Specifies a fully-qualified endpoint for connecting to Snowflake.
   */
  accessUrl?: string;

  /**
   * The login name for your Snowflake user or your Identity Provider (e.g. your login name for Okta).
   */
  username?: string;

  /**
   * Password for the user.
   */
  password?: string;

  /**
   * Host address to which the driver should connect.
   */
  host?: string;

  /**
   * The default virtual warehouse to use for the session after connecting. Used for performing queries, loading data, etc.
   */
  warehouse?: string;

  /**
   * The default database to use for the session after connecting.
   */
  database?: string;

  /**
   * The default schema to use for the session after connecting.
   */
  schema?: string;

  /**
   * The default security role to use for the session after connecting.
   */
  role?: string;

  /**
   * Specifies the authenticator to use for verifying user login credentials.
   *
   * Available options:
   * * `SNOWFLAKE` - Default authenticator that uses basic username/password authentication
   * * `EXTERNALBROWSER` - Browser-based SSO authentication through your identity provider
   * * `SNOWFLAKE_JWT` - Key pair authentication using a private key and public key pair
   * * `OAUTH` - OAuth authentication using a token obtained from OAuth flow
   * * `USERNAME_PASSWORD_MFA` - Username/password with multi-factor authentication
   * * `PROGRAMMATIC_ACCESS_TOKEN` - Using a programmatic access token set in ConnectionOptions.token or ConnectionOptions.password
   * * `OAUTH_AUTHORIZATION_CODE` - OAuth authorization code flow for web applications
   * * `OAUTH_CLIENT_CREDENTIALS` - OAuth client credentials flow for service-to-service auth
   * * `WORKLOAD_IDENTITY` - Workload identity authentication
   * * `https://<okta_account_name>.okta.com` - Native SSO authentication through Okta
   */
  authenticator?: string;

  /**
   * Enable SSO token caching. The default value is false.
   *
   * https://docs.snowflake.com/en/developer-guide/node-js/nodejs-driver-authenticate#authentication-token-caching
   */
  clientStoreTemporaryCredential?: boolean;

  /**
   * By default, client connections typically time out approximately 3-4 hours after the most recent query was executed.
   */
  clientSessionKeepAlive?: boolean;

  /**
   * Sets the frequency (interval in seconds) between heartbeat messages.
   */
  clientSessionKeepAliveHeartbeatFrequency?: number;

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
   * Value of `client id` provided by the identity provider for Snowflake integration (Snowflake security integration metadata).
   */
  oauthClientId?: string;

  /**
   * Value of the `client secret` provided by the identity provider for Snowflake integration (Snowflake security integration metadata).
   */
  oauthClientSecret?: string;

  /**
   * Identity provider endpoint supplying the authorization code to the driver.
   * When Snowflake is used as an identity provider, this value is derived from the `server` or `account` parameters.
   */
  oauthAuthorizationUrl?: string;

  /**
   * Identity Provider endpoint supplying the access tokens to the driver.
   * When using Snowflake as an Identity Provider, this value is derived from the `server` or `account` parameters.
   */
  oauthTokenRequestUrl?: string;

  /**
   * Scope requested in the Identity Provider authorization request.
   * By default, it is derived from the role.
   * When multiple scopes are required, the value should be a space-separated list of multiple scopes.
   */
  oauthScope?: string;

  /**
   * URI to use for authorization code redirection (Snowflake security integration metadata).
   * Default: `http://127.0.0.1:{randomAvailablePort}`.
   */
  oauthRedirectUri?: string;

  /**
   * @deprecated
   * FOR TESTING ONLY. Allows to use insecure http requests.
   */
  oauthHttpAllowed?: boolean;

  /**
   * When authenticator=OAUTH_AUTHORIZATION_CODE, customize the code challenge method
   */
  oauthChallengeMethod?: string;

  /**
   * The option to enable the MFA token.
   *
   * @default false
   */
  clientRequestMFAToken?: boolean;

  /**
   * The option to skip the SAML URL check in the Okta authentication
   *
   * @default false
   */
  disableSamlURLCheck?: boolean;

  /**
   * Specifies the private key (in PEM format) for key pair authentication.
   */
  privateKey?: string;

  /**
   * Specifies the local path to the private key file (e.g. rsa_key.p8)
   */
  privateKeyPath?: string;

  /**
   * Specifies the passcode to decrypt the private key file, if the file is encrypted.
   */
  privateKeyPass?: string;

  /**
   * When authenticator=WORKLOAD_IDENTITY, specifies the identity provider. Available options:
   * * AWS - Uses `@aws-sdk` to find credentials and encodes signed GetCallerIdentity request as token
   * * AZURE - Uses `@azure/identity` to find credentials and get JWT token
   * * GCP - Uses `google-auth-library` to find credentials and get JWT token
   * * OIDC - Reads JWT token from `ConnectionOptions.token`
   */
  workloadIdentityProvider?: WorkloadIdentityProviderKey;

  /**
   * When authenticator=WORKLOAD_IDENTITY, specifies a chain of service accounts for transitive impersonation.
   * Each element represents a service account to impersonate in sequence, allowing workloads to authenticate
   * as a different identity than their default attached service account.
   *
   * Supported for AWS and GCP.
   */
  workloadIdentityImpersonationPath?: string[];

  /**
   * When workloadIdentityProvider=AZURE, customize Azure Entra Id Resource
   */
  workloadIdentityAzureEntraIdResource?: string;

  /**
   * When workloadIdentityProvider=AZURE, customize Azure Managed Identity Client Id
   */
  workloadIdentityAzureClientId?: string;

  /**
   * Enables Certificate Revocation List (CRL) validation.
   *
   * When "ADVISORY" is set, it fails only if the certificate is revoked.
   * Any other error (network, parsing, etc.) will assume that the certificate is not revoked and allow the connection.
   *
   * @default "DISABLED"
   */
  certRevocationCheckMode?: CRLValidatorConfig['checkMode'];

  /**
   * Allows to connect when certificate doesn't have CRL URLs (cRLDistributionPoints)
   *
   * This option applies only when certRevocationCheckMode is `ADVISORY` or `ENABLED`
   *
   * @default false
   */
  crlAllowCertificatesWithoutCrlURL?: CRLValidatorConfig['allowCertificatesWithoutCrlURL'];

  /**
   * Enable CRL caching in memory.
   *
   * This option applies only when certRevocationCheckMode is `ADVISORY` or `ENABLED`
   *
   * @default true
   */
  crlInMemoryCache?: CRLValidatorConfig['inMemoryCache'];

  /**
   * Enable CRL caching on disk. Disk read/write failures are ignored.
   *
   * This option applies only when certRevocationCheckMode is `ADVISORY` or `ENABLED`
   *
   * @default true
   */
  crlOnDiskCache?: CRLValidatorConfig['onDiskCache'];

  /**
   * Controls how many rows are buffered by the stream returned from
   * `statement.streamRows()`. Passed as the `highWaterMark` to the
   * underlying Node.js Readable class.
   *
   * @default 10
   */
  rowStreamHighWaterMark?: number;

  /**
   * Specifies the name of the client application connecting to Snowflake.
   */
  application?: string;

  /**
   * The option to use https request only for the snowflake server if other GCP metadata or configuration is already set on the machine.
   *
   * @default false
   */
  forceGCPUseDownscopedCredential?: boolean;

  /**
   * Turn on the validation function which checks whether all the connection configuration from users are valid or not.
   *
   * @default false
   */
  validateDefaultParameters?: boolean;
}

/**
 * Work In Progress typing for ConnectionConfig instance
 */
export type WIP_ConnectionConfig =
  // NOTE:
  // Temporary explicit mapping as not every option is available on ConnectionConfig instance
  // e.g. instead of oauthClientId we have getOauthClientId().
  //
  // Future plan is to remove this type and let TypeScript to infer types automatically from
  // ConnectionConfig code.
  Pick<
    WIP_ConnectionOptions,
    | 'token'
    | 'workloadIdentityProvider'
    | 'workloadIdentityImpersonationPath'
    | 'workloadIdentityAzureEntraIdResource'
    | 'workloadIdentityAzureClientId'
    | 'oauthEnableSingleUseRefreshTokens'
    | 'rowStreamHighWaterMark'
  > & {
    crlValidatorConfig: CRLValidatorConfig;
    getClientType(): string;
    getClientVersion(): string;
    getClientApplication(): string;
    getOauthHttpAllowed(): boolean;
    getOauthClientId(): string;
    getOauthClientSecret(): string;
    getProxy(): { [key: string]: any }; // TODO: return a proper object shape when typing connection_config.js
  };
