import sinon from 'sinon';
import assert from 'assert';
import * as AzureIdentity from '@azure/identity';
import {
  getAzureAttestationToken,
  DEFAULT_AZURE_ENTRA_ID_RESOURCE,
} from '../../../../lib/authentication/auth_workload_identity/attestation_azure';

describe('Attestation AZURE', () => {
  const sinonSandbox = sinon.createSandbox();
  let getAzureTokenStub: sinon.SinonStub;

  beforeEach(() => {
    getAzureTokenStub = sinonSandbox.stub();
    sinonSandbox
      .stub(AzureIdentity.DefaultAzureCredential.prototype, 'getToken')
      .get(() => getAzureTokenStub);
  });

  beforeEach(() => {
    getAzureTokenStub.returns({ token: 'test-token' });
  });

  afterEach(() => {
    sinonSandbox.restore();
  });

  it('uses default Azure Entra Id Resource when none provided', async () => {
    await getAzureAttestationToken();
    assert.strictEqual(getAzureTokenStub.firstCall.args[0], DEFAULT_AZURE_ENTRA_ID_RESOURCE);
  });

  it('uses custom Azure Entra Id Resource when provided', async () => {
    await getAzureAttestationToken({ entraIdResource: 'custom-entra-id-resource' });
    assert.strictEqual(getAzureTokenStub.firstCall.args[0], 'custom-entra-id-resource');
  });

  it('throws error when fails to get token (missing credentials, no access)', async () => {
    const err = new Error('Failed to get token');
    getAzureTokenStub.throws(err);
    assert.rejects(getAzureAttestationToken(), err);
  });

  it('returns valid token', async () => {
    const token = await getAzureAttestationToken();
    assert.strictEqual(token, 'test-token');
  });
});
