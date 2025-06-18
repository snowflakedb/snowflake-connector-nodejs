import sinon from 'sinon';
import assert from 'assert';
import { GoogleAuth } from 'google-auth-library';
import { getGcpAttestationToken, SNOWFLAKE_AUDIENCE } from '../../../../lib/authentication/auth_workload_identity/attestation_gcp';

describe('Attestation GCP', () => {
  const sinonSandbox = sinon.createSandbox();
  let getIdTokenClientStub: sinon.SinonStub;
  let fetchIdTokenStub: sinon.SinonStub;

  beforeEach(async () => {
    fetchIdTokenStub = sinon.stub();
    getIdTokenClientStub = sinon.stub().returns({
      idTokenProvider: {
        fetchIdToken: fetchIdTokenStub,
      },
    });
    sinonSandbox.stub(GoogleAuth.prototype, 'getIdTokenClient').callsFake(getIdTokenClientStub);
  });

  afterEach(() => {
    sinonSandbox.restore();
  });

  it('calls fetchIdToken with the correct audience', async () => {
    await getGcpAttestationToken();
    assert.strictEqual(getIdTokenClientStub.firstCall.args[0], SNOWFLAKE_AUDIENCE);
    assert.strictEqual(fetchIdTokenStub.firstCall.args[0], SNOWFLAKE_AUDIENCE);
  });

  it('returns null when the token is not found', async () => {
    fetchIdTokenStub.throws(new Error('Token not found'));
    const token = await getGcpAttestationToken();
    assert.strictEqual(token, null);
  });

  it('returns the token when it is found', async () => {
    fetchIdTokenStub.resolves('test-token');
    const token = await getGcpAttestationToken();
    assert.strictEqual(token, 'test-token');
  });
});
