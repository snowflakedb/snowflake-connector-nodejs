import sinon from 'sinon';
import assert from 'assert';
import * as OriginalAttestationAws from '../../../../lib/authentication/auth_workload_identity/attestation_aws';
import { mockAwsSdk, assertAwsAttestationToken, AWS_REGION, AWS_CREDENTIALS } from './test_utils';

describe('Attestation AWS', () => {
  const sinonSandbox = sinon.createSandbox();
  let awsSdkStub: ReturnType<typeof mockAwsSdk>;
  let AttestationAws: typeof OriginalAttestationAws;

  before(async () => {
    awsSdkStub = mockAwsSdk(sinonSandbox);
    AttestationAws = (await import('../../../../lib/authentication/auth_workload_identity/attestation_aws'));
  });

  beforeEach(() => {
    sinonSandbox.restore();
    awsSdkStub.credentials.returnsNotFound();
    awsSdkStub.metadataRegion.returnsNotFound();
  });

  after(() => {
    awsSdkStub.restore();
  });

  describe('getAwsCredentials', () => {
    it('returns null when no credentials are found', async () => {
      assert.strictEqual(await AttestationAws.getAwsCredentials(), null);
    });

    it('returns credentials when credentials are found', async () => {
      awsSdkStub.credentials.returnsValid();
      assert.strictEqual(await AttestationAws.getAwsCredentials(), AWS_CREDENTIALS);
    });
  });

  describe('getAwsRegion', () => {
    it('returns process.env.AWS_REGION when available', async () => {
      sinonSandbox.stub(process, 'env').value({ AWS_REGION });
      assert.strictEqual(await AttestationAws.getAwsRegion(), AWS_REGION);
    });

    it('returns null when metadata service fails', async () => {
      assert.strictEqual(await AttestationAws.getAwsRegion(), null);
    });

    it('returns region when metadata service returns a region', async () => {
      awsSdkStub.metadataRegion.returnsValid();
      assert.strictEqual(await AttestationAws.getAwsRegion(), AWS_REGION);
    });
  });

  describe('getAwsAttestationToken', () => {
    it('returns null when no credentials are found', async () => {
      assert.strictEqual(await AttestationAws.getAwsAttestationToken(), null);
    });

    it('returns null when no region is found', async () => {
      awsSdkStub.credentials.returnsValid();
      assert.strictEqual(await AttestationAws.getAwsAttestationToken(), null);
    });

    it('returns a valid attestation token', async () => {
      awsSdkStub.credentials.returnsValid();
      awsSdkStub.metadataRegion.returnsValid();
      const token = await AttestationAws.getAwsAttestationToken();
      assertAwsAttestationToken(token);
    });
  });
});
