import sinon from 'sinon';
import rewiremock from 'rewiremock/node';
import assert from 'assert';
import * as AzureIdentity from '@azure/identity';
import { GoogleAuth } from 'google-auth-library';
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
      workloadIdentity: {
        provider: 'AWS',
      },
      enableExperimentalWorkloadIdentityAuth: undefined,
    }), /Experimental Workload identity authentication is not enabled/);
  });

  it('throws error when authenticate() is called with invalid workloadIdentity.provider', () => {
    const auth = new AuthWorkloadIdentity({
      workloadIdentity: {
        // @ts-expect-error - Invalid provider
        provider: 'INVALID',
      },
      enableExperimentalWorkloadIdentityAuth: true,
    });
    assert.rejects(auth.authenticate(), new RegExp('requires workloadIdentity.provider'));
  });

  it('reauthenticate() throws TODO error', async () => {
    const auth = new AuthWorkloadIdentity({
      workloadIdentity: {
        provider: 'AWS',
      },
      enableExperimentalWorkloadIdentityAuth: true
    });
    await assert.rejects(auth.reauthenticate({ data: {} }), /TODO: Not implemented/);
  });

  describe('AWS', () => {
    const connectionConfig: WIP_ConnectionConfig = {
      workloadIdentity: {
        provider: 'AWS',
      },
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
      auth.updateBody(body);
      assert.strictEqual(body.data.AUTHENTICATOR, 'WORKLOAD_IDENTITY');
      assert.strictEqual(body.data.PROVIDER, 'AWS');
      assertAwsAttestationToken(body.data.TOKEN, AWS_REGION);
    });
  });

  describe('AZURE', () => {
    const connectionConfig: WIP_ConnectionConfig = {
      workloadIdentity: {
        provider: 'AZURE',
      },
      enableExperimentalWorkloadIdentityAuth: true,
    };
    let getAzureTokenStub: sinon.SinonStub;

    beforeEach(() => {
      getAzureTokenStub = sinonSandbox.stub();
      sinonSandbox
        .stub(AzureIdentity.DefaultAzureCredential.prototype, 'getToken')
        .get(() => getAzureTokenStub);
    });

    it('authenticate() throws error when credentials are not found', async () => {
      getAzureTokenStub.throws(new Error('no credentials'));
      const auth = new AuthWorkloadIdentity(connectionConfig);
      await assert.rejects(auth.authenticate(), /No workload identity credentials were found. Provider: AZURE/);
    });

    it('authenticate() sets valid fields for updateBody() to use', async () => {
      getAzureTokenStub.returns({ token: 'test-token' });
      const auth = new AuthWorkloadIdentity(connectionConfig);
      const body: AuthRequestBody = { data: {} };
      await auth.authenticate();
      auth.updateBody(body);
      assert.strictEqual(body.data.AUTHENTICATOR, 'WORKLOAD_IDENTITY');
      assert.strictEqual(body.data.PROVIDER, 'AZURE');
      assert.strictEqual(body.data.TOKEN, 'test-token');
    });
  });

  describe('GCP', () => {
    const connectionConfig: WIP_ConnectionConfig = {
      workloadIdentity: {
        provider: 'GCP',
      },
      enableExperimentalWorkloadIdentityAuth: true,
    };
    let fetchIdTokenStub: sinon.SinonStub;

    beforeEach(() => {
      fetchIdTokenStub = sinonSandbox.stub();
      sinonSandbox.stub(GoogleAuth.prototype, 'getIdTokenClient').resolves({
        idTokenProvider: {
          fetchIdToken: fetchIdTokenStub,
        },
      } as any);
    });

    it('authenticate() throws error when credentials are not found', async () => {
      const auth = new AuthWorkloadIdentity(connectionConfig);
      await assert.rejects(auth.authenticate(), /No workload identity credentials were found. Provider: GCP/);
    });

    it('authenticate() sets valid fields for updateBody() to use', async () => {
      fetchIdTokenStub.returns('test-token');
      const auth = new AuthWorkloadIdentity(connectionConfig);
      const body: AuthRequestBody = { data: {} };
      await auth.authenticate();
      auth.updateBody(body);
      assert.strictEqual(body.data.AUTHENTICATOR, 'WORKLOAD_IDENTITY');
      assert.strictEqual(body.data.PROVIDER, 'GCP');
      assert.strictEqual(body.data.TOKEN, 'test-token');
    });
  });
});
