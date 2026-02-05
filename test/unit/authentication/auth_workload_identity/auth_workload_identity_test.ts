import { vi } from 'vitest';
import assert from 'assert';
import * as AzureIdentity from '@azure/identity';
import * as AttestationAzureModule from '../../../../lib/authentication/auth_workload_identity/attestation_azure';
import { GoogleAuth } from 'google-auth-library';
import { WIP_ConnectionConfig, WIP_ConnectionOptions } from '../../../../lib/connection/types';
import { AuthRequestBody } from '../../../../lib/authentication/types';
import OriginalAuthWorkloadIdentity from '../../../../lib/authentication/auth_workload_identity';
import { assertAwsAttestationToken, AWS_CREDENTIALS, AWS_REGION } from './test_utils';
import ConnectionConfig from '../../../../lib/connection/connection_config';

// Create mock functions outside describe to use in vi.mock
const awsSdkMock = {
  getCredentials: vi.fn(),
  getMetadataRegion: vi.fn(),
};
const getAzureTokenMock = vi.fn();
const getGcpTokenMock = vi.fn();

// Mock AWS SDK modules at module level
vi.mock('@aws-sdk/credential-provider-node', () => ({
  defaultProvider: () => awsSdkMock.getCredentials,
}));

vi.mock('@aws-sdk/ec2-metadata-service', () => ({
  MetadataService: class {
    request = () => awsSdkMock.getMetadataRegion();
  },
}));

describe('Workload Identity Authentication', async () => {
  let AuthWorkloadIdentity: typeof OriginalAuthWorkloadIdentity;

  function getConnectionConfig(
    options: Omit<WIP_ConnectionOptions, 'account'> = {},
  ): WIP_ConnectionConfig {
    return new ConnectionConfig({
      authenticator: 'WORKLOAD_IDENTITY',
      account: 'test-account',
      ...options,
    });
  }

  before(async () => {
    // Import after mocks are set up
    AuthWorkloadIdentity = (await import('../../../../lib/authentication/auth_workload_identity'))
      .default;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AzureIdentity.DefaultAzureCredential.prototype, 'getToken', 'get').mockReturnValue(
      getAzureTokenMock as any,
    );
    vi.spyOn(GoogleAuth.prototype, 'getIdTokenClient').mockResolvedValue({
      idTokenProvider: {
        fetchIdToken: getGcpTokenMock,
      },
    } as any);
  });

  [
    {
      name: 'missing workloadIdentityProvider',
      config: {},
    },
    {
      name: 'invalid workloadIdentityProvider',
      config: {
        workloadIdentityProvider: 'invalid' as WIP_ConnectionOptions['workloadIdentityProvider'],
      },
    },
  ].forEach((testCase) => {
    it(`authenticate() throws error for ${testCase.name}`, async () => {
      const connectionConfig = getConnectionConfig(testCase.config);
      const auth = new AuthWorkloadIdentity(connectionConfig);
      await assert.rejects(
        auth.authenticate(),
        /InvalidParameterError: Invalid authenticator: WORKLOAD_IDENTITY parameters. workloadIdentityProvider must be one of: AWS, AZURE, GCP, OIDC/,
      );
    });
  });

  describe('authenticate() with OIDC', () => {
    const connectionConfig = getConnectionConfig({
      token: 'test-token',
      workloadIdentityProvider: 'OIDC',
    });

    it('throws error when impersonation path is provided', async () => {
      const auth = new AuthWorkloadIdentity({
        ...connectionConfig,
        workloadIdentityImpersonationPath: ['test-path'],
      });
      await assert.rejects(
        auth.authenticate(),
        /workloadIdentityImpersonationPath for OIDC is not supported/,
      );
    });

    it('throws error when token is not provided', async () => {
      const auth = new AuthWorkloadIdentity({ ...connectionConfig, token: undefined });
      await assert.rejects(
        auth.authenticate(),
        /workloadIdentityProvider: OIDC requires token in connection options/,
      );
    });

    it('sets valid fields for updateBody() to use', async () => {
      const auth = new AuthWorkloadIdentity(connectionConfig);
      const body: AuthRequestBody = { data: {} };
      await auth.authenticate();
      auth.updateBody(body);
      assert.strictEqual(body.data.AUTHENTICATOR, 'WORKLOAD_IDENTITY');
      assert.strictEqual(body.data.PROVIDER, 'OIDC');
      assert.strictEqual(body.data.TOKEN, connectionConfig.token);
    });
  });

  describe('authenticate() with AWS', () => {
    const connectionConfig = getConnectionConfig({
      workloadIdentityProvider: 'AWS',
    });

    it('throws error when credentials are not found', async () => {
      const err = new Error('No credentials found');
      awsSdkMock.getCredentials.mockImplementation(() => {
        throw err;
      });
      const auth = new AuthWorkloadIdentity(connectionConfig);
      await assert.rejects(auth.authenticate(), err);
    });

    it('sets valid fields for updateBody() to use', async () => {
      awsSdkMock.getCredentials.mockReturnValue(AWS_CREDENTIALS);
      awsSdkMock.getMetadataRegion.mockReturnValue(AWS_REGION);
      const auth = new AuthWorkloadIdentity(connectionConfig);
      const body: AuthRequestBody = { data: {} };
      await auth.authenticate();
      auth.updateBody(body);
      assert.strictEqual(body.data.AUTHENTICATOR, 'WORKLOAD_IDENTITY');
      assert.strictEqual(body.data.PROVIDER, 'AWS');
      assertAwsAttestationToken(body.data.TOKEN, AWS_REGION);
    });
  });

  describe('authenticate() with AZURE', () => {
    const connectionConfig = getConnectionConfig({
      workloadIdentityProvider: 'AZURE',
    });

    it('throws error when credentials are not found', async () => {
      const err = new Error('no credentials');
      getAzureTokenMock.mockImplementation(() => {
        throw err;
      });
      const auth = new AuthWorkloadIdentity(connectionConfig);
      await assert.rejects(auth.authenticate(), err);
    });

    it('throws error when impersonation path is provided', async () => {
      const auth = new AuthWorkloadIdentity({
        ...connectionConfig,
        workloadIdentityImpersonationPath: ['test-path'],
      });
      await assert.rejects(
        auth.authenticate(),
        /workloadIdentityImpersonationPath for AZURE is not supported/,
      );
    });

    it('passes azure-specific config options to getAzureAttestationToken', async () => {
      getAzureTokenMock.mockReturnValue({ token: 'test-token' });
      const getAzureAttestionTokenSpy = vi.spyOn(
        AttestationAzureModule,
        'getAzureAttestationToken',
      );
      const auth = new AuthWorkloadIdentity({
        ...connectionConfig,
        workloadIdentityAzureClientId: 'custom-managed-identity-client-id',
        workloadIdentityAzureEntraIdResource: 'custom-entra-id-resource',
      });
      await auth.authenticate();
      assert.deepEqual(getAzureAttestionTokenSpy.mock.calls[0][0], {
        managedIdentityClientId: 'custom-managed-identity-client-id',
        entraIdResource: 'custom-entra-id-resource',
      });
    });

    it('sets valid fields for updateBody() to use', async () => {
      getAzureTokenMock.mockReturnValue({ token: 'test-token' });
      const auth = new AuthWorkloadIdentity(connectionConfig);
      const body: AuthRequestBody = { data: {} };
      await auth.authenticate();
      auth.updateBody(body);
      assert.strictEqual(body.data.AUTHENTICATOR, 'WORKLOAD_IDENTITY');
      assert.strictEqual(body.data.PROVIDER, 'AZURE');
      assert.strictEqual(body.data.TOKEN, 'test-token');
    });
  });

  describe('authenticate() with GCP', () => {
    const connectionConfig = getConnectionConfig({
      workloadIdentityProvider: 'GCP',
    });

    it('throws error when credentials are not found', async () => {
      const err = new Error('no credentials');
      getGcpTokenMock.mockImplementation(() => {
        throw err;
      });
      const auth = new AuthWorkloadIdentity(connectionConfig);
      await assert.rejects(auth.authenticate(), err);
    });

    it('sets valid fields for updateBody() to use', async () => {
      getGcpTokenMock.mockReturnValue('test-token');
      const auth = new AuthWorkloadIdentity(connectionConfig);
      const body: AuthRequestBody = { data: {} };
      await auth.authenticate();
      auth.updateBody(body);
      assert.strictEqual(body.data.AUTHENTICATOR, 'WORKLOAD_IDENTITY');
      assert.strictEqual(body.data.PROVIDER, 'GCP');
      assert.strictEqual(body.data.TOKEN, 'test-token');
    });
  });
});
