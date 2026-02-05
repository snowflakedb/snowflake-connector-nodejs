import { vi, type MockInstance } from 'vitest';
import assert from 'assert';
import * as AzureIdentity from '@azure/identity';
import {
  getAzureAttestationToken,
  DEFAULT_AZURE_ENTRA_ID_RESOURCE,
} from '../../../../lib/authentication/auth_workload_identity/attestation_azure';

describe('Attestation AZURE', () => {
  let getAzureTokenStub: MockInstance;

  beforeEach(() => {
    getAzureTokenStub = vi.fn().mockReturnValue({ token: 'test-token' });
    vi.spyOn(AzureIdentity.DefaultAzureCredential.prototype, 'getToken', 'get').mockReturnValue(
      getAzureTokenStub as any,
    );
  });

  it('uses default Azure Entra Id Resource when none provided', async () => {
    await getAzureAttestationToken();
    assert.strictEqual(getAzureTokenStub.mock.calls[0][0], DEFAULT_AZURE_ENTRA_ID_RESOURCE);
  });

  it('uses custom Azure Entra Id Resource when provided', async () => {
    await getAzureAttestationToken({ entraIdResource: 'custom-entra-id-resource' });
    assert.strictEqual(getAzureTokenStub.mock.calls[0][0], 'custom-entra-id-resource');
  });

  it('throws error when fails to get token (missing credentials, no access)', async () => {
    const err = new Error('Failed to get token');
    getAzureTokenStub.mockImplementation(() => {
      throw err;
    });
    assert.rejects(getAzureAttestationToken(), err);
  });

  it('returns valid token', async () => {
    const token = await getAzureAttestationToken();
    assert.strictEqual(token, 'test-token');
  });
});
