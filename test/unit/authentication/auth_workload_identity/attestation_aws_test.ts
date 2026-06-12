import sinon from 'sinon';
import assert from 'assert';
import rewiremock from 'rewiremock/node';
import * as OriginalAttestationAws from '../../../../lib/authentication/auth_workload_identity/attestation_aws';
import { AWS_CREDENTIALS, AWS_REGION, AWS_WEB_IDENTITY_TOKEN } from './test_utils';

class FakeAssumeRoleCommand {}
class FakeGetWebIdentityTokenCommand {}

describe('Attestation AWS', () => {
  const sinonSandbox = sinon.createSandbox();
  const awsSdkMock = {
    getDefaultCredentials: sinonSandbox.stub(),
    getMetadataRegion: sinonSandbox.stub(),
    sendAssumeRole: sinonSandbox.stub().returns({ Credentials: null }),
    sendGetWebIdentityToken: sinonSandbox.stub(),
  };
  let AttestationAws: typeof OriginalAttestationAws;
  const noCredentialsError = new Error('No credentials found');
  const noRegionError = new Error('No region found');

  before(() => {
    // NOTE:
    // Sinon can't stub frozen AWS SDK properties, so we need to mock entire require
    rewiremock('@aws-sdk/credential-provider-node').with({
      defaultProvider: () => awsSdkMock.getDefaultCredentials,
    });
    rewiremock('@aws-sdk/client-sts').with({
      AssumeRoleCommand: FakeAssumeRoleCommand,
      GetWebIdentityTokenCommand: FakeGetWebIdentityTokenCommand,
      STSClient: class {
        send = (command: unknown) => {
          if (command instanceof FakeGetWebIdentityTokenCommand) {
            return awsSdkMock.sendGetWebIdentityToken();
          }
          return awsSdkMock.sendAssumeRole();
        };
      },
    });
    rewiremock('@aws-sdk/ec2-metadata-service').with({
      MetadataService: class {
        request = () => awsSdkMock.getMetadataRegion();
      },
    });
    rewiremock.enable();
    AttestationAws = require('../../../../lib/authentication/auth_workload_identity/attestation_aws');
  });

  beforeEach(() => {
    sinonSandbox.restore();
    awsSdkMock.sendAssumeRole.resetHistory();
    awsSdkMock.sendGetWebIdentityToken.resetHistory();
    awsSdkMock.getDefaultCredentials.throws(noCredentialsError);
    awsSdkMock.getMetadataRegion.throws(noRegionError);
    awsSdkMock.sendAssumeRole.returns({ Credentials: null });
    awsSdkMock.sendGetWebIdentityToken.returns({ WebIdentityToken: AWS_WEB_IDENTITY_TOKEN });
  });

  after(() => {
    rewiremock.disable();
  });

  describe('getAwsCredentials', () => {
    it('throws error when no credentials are found', async () => {
      await assert.rejects(AttestationAws.getAwsCredentials(AWS_REGION), noCredentialsError);
    });

    it('throws error when fails to fetch impersonation role credentials', async () => {
      awsSdkMock.getDefaultCredentials.returns(AWS_CREDENTIALS);
      await assert.rejects(
        AttestationAws.getAwsCredentials(AWS_REGION, ['impersonation-role']),
        /Failed to get credentials from impersonation role impersonation-role/,
      );
    });

    it('returns credentials from default provider', async () => {
      awsSdkMock.getDefaultCredentials.returns(AWS_CREDENTIALS);
      assert.strictEqual(await AttestationAws.getAwsCredentials(AWS_REGION), AWS_CREDENTIALS);
    });

    it('returns credentials from impersonation role', async () => {
      const impersonationCredentials = {
        AccessKeyId: 'impersonation-access-key-id',
        SecretAccessKey: 'impersonation-secret-access-key',
      };
      awsSdkMock.getDefaultCredentials.returns(AWS_CREDENTIALS);
      awsSdkMock.sendAssumeRole.returns({ Credentials: impersonationCredentials });
      assert.deepEqual(await AttestationAws.getAwsCredentials(AWS_REGION, ['impersonation-role']), {
        accessKeyId: impersonationCredentials.AccessKeyId,
        secretAccessKey: impersonationCredentials.SecretAccessKey,
        sessionToken: undefined,
      });
    });
  });

  describe('getAwsRegion', () => {
    it('returns process.env.AWS_REGION when available', async () => {
      sinonSandbox.stub(process, 'env').value({ AWS_REGION: 'region-from-env' });
      assert.strictEqual(await AttestationAws.getAwsRegion(), 'region-from-env');
    });

    it('throws error when metadata service fails', async () => {
      await assert.rejects(AttestationAws.getAwsRegion(), noRegionError);
    });

    it('returns region when metadata service returns a region', async () => {
      awsSdkMock.getMetadataRegion.returns(AWS_REGION);
      assert.strictEqual(await AttestationAws.getAwsRegion(), AWS_REGION);
    });
  });

  describe('getAwsAttestationToken', () => {
    it('throws error when no credentials are found', async () => {
      awsSdkMock.getMetadataRegion.returns(AWS_REGION);
      await assert.rejects(AttestationAws.getAwsAttestationToken(), noCredentialsError);
    });

    it('throws error when no region is found', async () => {
      await assert.rejects(AttestationAws.getAwsAttestationToken(), noRegionError);
    });

    it('throws error when STS returns no WebIdentityToken', async () => {
      awsSdkMock.getDefaultCredentials.returns(AWS_CREDENTIALS);
      awsSdkMock.getMetadataRegion.returns(AWS_REGION);
      awsSdkMock.sendGetWebIdentityToken.returns({});
      await assert.rejects(
        AttestationAws.getAwsAttestationToken(),
        /Failed to obtain AWS web identity token from STS/,
      );
    });

    it('returns the WebIdentityToken JWT from STS', async () => {
      awsSdkMock.getDefaultCredentials.returns(AWS_CREDENTIALS);
      awsSdkMock.getMetadataRegion.returns(AWS_REGION);
      const token = await AttestationAws.getAwsAttestationToken();
      assert.strictEqual(token, AWS_WEB_IDENTITY_TOKEN);
    });

    it('returns the WebIdentityToken JWT when impersonation path is provided', async () => {
      const impersonationCredentials = {
        AccessKeyId: 'impersonation-access-key-id',
        SecretAccessKey: 'impersonation-secret-access-key',
      };
      awsSdkMock.getDefaultCredentials.returns(AWS_CREDENTIALS);
      awsSdkMock.getMetadataRegion.returns(AWS_REGION);
      awsSdkMock.sendAssumeRole.returns({ Credentials: impersonationCredentials });
      const token = await AttestationAws.getAwsAttestationToken(['impersonation-role']);
      assert.strictEqual(token, AWS_WEB_IDENTITY_TOKEN);
      assert.strictEqual(awsSdkMock.sendAssumeRole.callCount, 1);
      assert.strictEqual(awsSdkMock.sendGetWebIdentityToken.callCount, 1);
    });
  });
});
