import sinon from 'sinon';
import rewiremock from 'rewiremock/node';
import assert from 'assert';
import { WIP_ConnectionConfig } from '../../../../lib/connection/types';
import { AuthRequestBody } from '../../../../lib/authentication/types';
import OriginalAuthWorkloadIdentity from '../../../../lib/authentication/auth_workload_identity';
import { assertAwsAttestationToken, AWS_CREDENTIALS, AWS_REGION } from './test_utils';

describe('Workload Identity Authentication', async () => {
  const sinonSandbox = sinon.createSandbox();
  const awsSdkMock = {
    getCredentials: sinonSandbox.stub(),
    getMetadataRegion: sinonSandbox.stub(),
  };
  let AuthWorkloadIdentity: typeof OriginalAuthWorkloadIdentity;

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
    AuthWorkloadIdentity = (await import('../../../../lib/authentication/auth_workload_identity')).default;
  });

  afterEach(() => {
    sinonSandbox.restore();
  });

  after(() => {
    rewiremock.disable();
  });

  it('throws error when instance is created without enableExperimentalWorkloadIdentityAuth', () => {
    assert.throws(() => new AuthWorkloadIdentity({
      workloadIdentityProvider: 'AWS',
      enableExperimentalWorkloadIdentityAuth: undefined,
    }), /Experimental Workload identity authentication is not enabled/);
  });

  it('throws error when instance is created with invalid workloadIdentityProvider', () => {
    assert.throws(() => new AuthWorkloadIdentity({
      workloadIdentityProvider: undefined,
      enableExperimentalWorkloadIdentityAuth: true,
    }), /requires workloadIdentityProvider: 'AWS'/);
  });

  describe('AWS', () => {
    const connectionConfig: WIP_ConnectionConfig = {
      workloadIdentityProvider: 'AWS',
      enableExperimentalWorkloadIdentityAuth: true,
    };

    it('authenticate() throws error when credentials are not found', async () => {
      const auth = new AuthWorkloadIdentity(connectionConfig);
      await assert.rejects(auth.authenticate(), /No workload identity credentials were found. Provider: AWS/);
    });

    it('authenticate() sets valid fields for updateBody() to use', async () => {
      awsSdkMock.getCredentials.returns(AWS_CREDENTIALS);
      awsSdkMock.getMetadataRegion.returns(AWS_REGION);
      const auth = new AuthWorkloadIdentity(connectionConfig);
      const body: AuthRequestBody = { data: {} };
      await auth.authenticate();
      await auth.updateBody(body);
      assert.strictEqual(body.data.AUTHENTICATOR, 'WORKLOAD_IDENTITY');
      assert.strictEqual(body.data.PROVIDER, 'AWS');
      assertAwsAttestationToken(body.data.TOKEN, AWS_REGION);
    });

    it('reauthenticate() throws TODO error', async () => {
      const auth = new AuthWorkloadIdentity(connectionConfig);
      await assert.rejects(auth.reauthenticate({ data: {} }), /TODO: Not implemented/);
    });
  });
});
