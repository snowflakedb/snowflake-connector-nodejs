import sinon from 'sinon';
import assert from 'assert';
import rewiremock from 'rewiremock/node';
import * as OriginalAttestationAws from '../../../../lib/authentication/auth_workload_identity/attestation_aws';
import { assertAwsAttestationToken, AWS_CREDENTIALS, AWS_REGION } from './test_utils';

describe('Attestation AWS', () => {
  const sinonSandbox = sinon.createSandbox();
  const awsSdkMock = {
    getCredentials: sinonSandbox.stub(),
    getMetadataRegion: sinonSandbox.stub(),
  };
  let AttestationAws: typeof OriginalAttestationAws;

  before(async () => {
    // NOTE:
    // Sinon can't stub frozen AWS SDK properties, so we need to mock entire require
    rewiremock('@aws-sdk/credential-provider-node').with({
      defaultProvider: () => awsSdkMock.getCredentials,
    })
    rewiremock('@aws-sdk/ec2-metadata-service').with({
      MetadataService: class {
        request = () => awsSdkMock.getMetadataRegion();
      }
    });
    rewiremock.enable();
    AttestationAws = (await import('../../../../lib/authentication/auth_workload_identity/attestation_aws'));
  });

  beforeEach(() => {
    sinonSandbox.restore();
    awsSdkMock.getCredentials.throws(new Error('No credentials found'));
    awsSdkMock.getMetadataRegion.throws(new Error('No region found'));
  });

  after(() => {
    rewiremock.disable();
  });

  describe('getAwsCredentials', () => {
    it('returns null when no credentials are found', async () => {
      assert.strictEqual(await AttestationAws.getAwsCredentials(), null);
    });

    it('returns credentials when credentials are found', async () => {
      awsSdkMock.getCredentials.returns(AWS_CREDENTIALS);
      assert.strictEqual(await AttestationAws.getAwsCredentials(), AWS_CREDENTIALS);
    });
  });

  describe('getAwsRegion', () => {
    it('returns process.env.AWS_REGION when available', async () => {
      sinonSandbox.stub(process, 'env').value({ AWS_REGION: 'region-from-env' });
      assert.strictEqual(await AttestationAws.getAwsRegion(), 'region-from-env');
    });

    it('returns null when metadata service fails', async () => {
      assert.strictEqual(await AttestationAws.getAwsRegion(), null);
    });

    it('returns region when metadata service returns a region', async () => {
      awsSdkMock.getMetadataRegion.returns(AWS_REGION);
      assert.strictEqual(await AttestationAws.getAwsRegion(), AWS_REGION);
    });
  });

  describe('getAwsAttestationToken', () => {
    it('returns null when no credentials are found', async () => {
      assert.strictEqual(await AttestationAws.getAwsAttestationToken(), null);
    });

    it('returns null when no region is found', async () => {
      awsSdkMock.getCredentials.returns(AWS_CREDENTIALS);
      assert.strictEqual(await AttestationAws.getAwsAttestationToken(), null);
    });

    it('returns a valid attestation token', async () => {
      awsSdkMock.getCredentials.returns(AWS_CREDENTIALS);
      awsSdkMock.getMetadataRegion.returns(AWS_REGION);
      const token = await AttestationAws.getAwsAttestationToken();
      assertAwsAttestationToken(token, AWS_REGION);
    });
  });
});
