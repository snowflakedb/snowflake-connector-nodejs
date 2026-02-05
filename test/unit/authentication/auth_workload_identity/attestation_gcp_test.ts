import { vi } from 'vitest';
import assert from 'assert';
import { GoogleAuth, Impersonated } from 'google-auth-library';
import {
  getGcpAttestationToken,
  SNOWFLAKE_AUDIENCE,
} from '../../../../lib/authentication/auth_workload_identity/attestation_gcp';

describe('Attestation GCP', () => {
  const gcpSdkMock = {
    getIdTokenClient: vi.fn(),
    getClient: vi.fn(),
    fetchIdToken: vi.fn(),
    impersonatedFetchIdToken: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    gcpSdkMock.getIdTokenClient.mockReturnValue({
      idTokenProvider: {
        fetchIdToken: gcpSdkMock.fetchIdToken,
      },
    });
    gcpSdkMock.getClient.mockResolvedValue({});
    vi.spyOn(GoogleAuth.prototype, 'getIdTokenClient').mockImplementation(
      gcpSdkMock.getIdTokenClient,
    );
    vi.spyOn(GoogleAuth.prototype, 'getClient').mockImplementation(gcpSdkMock.getClient as any);
    vi.spyOn(Impersonated.prototype, 'fetchIdToken').mockImplementation(
      gcpSdkMock.impersonatedFetchIdToken,
    );
  });

  describe('using default credentials', () => {
    it('calls fetchIdToken with the correct audience', async () => {
      await getGcpAttestationToken();
      assert.strictEqual(gcpSdkMock.getIdTokenClient.mock.calls[0][0], SNOWFLAKE_AUDIENCE);
      assert.strictEqual(gcpSdkMock.fetchIdToken.mock.calls[0][0], SNOWFLAKE_AUDIENCE);
    });

    it('throws error when the token is not found', async () => {
      const err = new Error('Token not found');
      gcpSdkMock.fetchIdToken.mockImplementation(() => {
        throw err;
      });
      assert.rejects(getGcpAttestationToken(), err);
    });

    it('returns the token when it is found', async () => {
      gcpSdkMock.fetchIdToken.mockResolvedValue('test-token');
      const token = await getGcpAttestationToken();
      assert.strictEqual(token, 'test-token');
    });
  });

  describe('using impersonation', () => {
    it('throws error when impersonation fails', async () => {
      const err = new Error('Impersonation failed');
      gcpSdkMock.impersonatedFetchIdToken.mockImplementation(() => {
        throw err;
      });
      await assert.rejects(getGcpAttestationToken(['service-account']), err);
    });

    it('returns token', async () => {
      gcpSdkMock.impersonatedFetchIdToken.mockResolvedValue('impersonated-token');
      const token = await getGcpAttestationToken(['service-account']);
      assert.strictEqual(gcpSdkMock.impersonatedFetchIdToken.mock.calls[0][0], SNOWFLAKE_AUDIENCE);
      assert.strictEqual(token, 'impersonated-token');
    });
  });
});
