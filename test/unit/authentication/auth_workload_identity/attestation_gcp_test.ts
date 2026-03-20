import sinon from 'sinon';
import assert from 'assert';
import { GoogleAuth, Impersonated } from 'google-auth-library';
import {
  getGcpAttestationToken,
  SNOWFLAKE_AUDIENCE,
} from '../../../../lib/authentication/auth_workload_identity/attestation_gcp';

describe('Attestation GCP', () => {
  const sinonSandbox = sinon.createSandbox();
  const gcpSdkMock = {
    getIdTokenClient: sinonSandbox.stub(),
    getClient: sinonSandbox.stub(),
    fetchIdToken: sinonSandbox.stub(),
    impersonatedFetchIdToken: sinonSandbox.stub(),
  };

  beforeEach(async () => {
    gcpSdkMock.getIdTokenClient.returns({
      idTokenProvider: {
        fetchIdToken: gcpSdkMock.fetchIdToken,
      },
    });
    gcpSdkMock.getClient.resolves({});
    sinonSandbox
      .stub(GoogleAuth.prototype, 'getIdTokenClient')
      .callsFake(gcpSdkMock.getIdTokenClient);
    sinonSandbox.stub(GoogleAuth.prototype, 'getClient').callsFake(gcpSdkMock.getClient);
    sinonSandbox
      .stub(Impersonated.prototype, 'fetchIdToken')
      .callsFake(gcpSdkMock.impersonatedFetchIdToken);
  });

  afterEach(() => {
    sinonSandbox.restore();
  });

  describe('using default credentials', () => {
    it('calls fetchIdToken with the correct audience', async () => {
      await getGcpAttestationToken();
      assert.strictEqual(gcpSdkMock.getIdTokenClient.firstCall.args[0], SNOWFLAKE_AUDIENCE);
      assert.strictEqual(gcpSdkMock.fetchIdToken.firstCall.args[0], SNOWFLAKE_AUDIENCE);
    });

    it('throws error when the token is not found', async () => {
      const err = new Error('Token not found');
      gcpSdkMock.fetchIdToken.throws(err);
      assert.rejects(getGcpAttestationToken(), err);
    });

    it('returns the token when it is found', async () => {
      gcpSdkMock.fetchIdToken.resolves('test-token');
      const token = await getGcpAttestationToken();
      assert.strictEqual(token, 'test-token');
    });
  });

  describe('using impersonation', () => {
    it('throws error when impersonation fails', async () => {
      const err = new Error('Impersonation failed');
      gcpSdkMock.impersonatedFetchIdToken.throws(err);
      await assert.rejects(getGcpAttestationToken(['service-account']), err);
    });

    it('returns token', async () => {
      gcpSdkMock.impersonatedFetchIdToken.resolves('impersonated-token');
      const token = await getGcpAttestationToken(['service-account']);
      assert.strictEqual(gcpSdkMock.impersonatedFetchIdToken.firstCall.args[0], SNOWFLAKE_AUDIENCE);
      assert.strictEqual(token, 'impersonated-token');
    });
  });
});
