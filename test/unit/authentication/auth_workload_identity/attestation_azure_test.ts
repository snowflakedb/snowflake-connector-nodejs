import sinon from 'sinon';
import assert from 'assert';
import * as AzureIdentity from '@azure/identity';
import { getAzureAttestationToken, DEFAULT_AZURE_ENTRA_ID_RESOURCE } from "../../../../lib/authentication/auth_workload_identity/attestation_azure";

describe('Attestation AZURE', () => {
  const sinonSandbox = sinon.createSandbox();
  let getAzureTokenStub: sinon.SinonStub;

  beforeEach(() => {
    getAzureTokenStub = sinonSandbox.stub();
    sinonSandbox
      .stub(AzureIdentity.DefaultAzureCredential.prototype, 'getToken')
      .get(() => getAzureTokenStub);
  });

  afterEach(() => {
    sinonSandbox.restore();
  });

  it('uses default Azure Entra Id Resource when none provided', async () => {
    await getAzureAttestationToken();
    assert.strictEqual(getAzureTokenStub.firstCall.args[0], DEFAULT_AZURE_ENTRA_ID_RESOURCE);
  });

  it('uses custom Azure Entra Id Resource when provided', async () => {
    await getAzureAttestationToken('custom-token');
    assert.strictEqual(getAzureTokenStub.firstCall.args[0], 'custom-token');
  });

  it('returns null when fails to get token (missing credentials, no access)', async () => {
    getAzureTokenStub.throws(new Error('Failed to get token'));
    const token = await getAzureAttestationToken();
    assert.strictEqual(token, null);
  });

  it('returns valid token', async () => {
    getAzureTokenStub.returns({ token: 'test-token' });
    const token = await getAzureAttestationToken();
    assert.strictEqual(token, 'test-token');
  });
});
