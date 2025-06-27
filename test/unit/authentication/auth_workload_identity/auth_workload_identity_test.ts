import sinon from 'sinon';
import rewiremock from 'rewiremock/node';
import assert from 'assert';
import * as AzureIdentity from '@azure/identity';
import { GoogleAuth } from 'google-auth-library';
import { WIP_ConnectionConfig, WIP_ConnectionOptions } from '../../../../lib/connection/types';
import { AuthRequestBody } from '../../../../lib/authentication/types';
import OriginalAuthWorkloadIdentity from '../../../../lib/authentication/auth_workload_identity';
import { assertAwsAttestationToken, AWS_CREDENTIALS, AWS_REGION } from './test_utils';
import ConnectionConfig from '../../../../lib/connection/connection_config';

describe('Workload Identity Authentication', async () => {
  const cloudSdkStubs = sinon.createSandbox();
  const awsSdkMock = {
    getCredentials: cloudSdkStubs.stub(),
    getMetadataRegion: cloudSdkStubs.stub(),
  };
  const getAzureTokenMock = cloudSdkStubs.stub();
  const getGcpTokenMock = cloudSdkStubs.stub();
  let AuthWorkloadIdentity: typeof OriginalAuthWorkloadIdentity;

  function getConnectionConfig(options: WIP_ConnectionOptions = {}): WIP_ConnectionConfig {
    return new ConnectionConfig({
      authenticator: 'WORKLOAD_IDENTITY',
      account: 'test-account',
      ...options
    });
  }

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

  beforeEach(() => {
    sinon.stub(process, 'env').value({
      SF_ENABLE_EXPERIMENTAL_AUTHENTICATION: 'true'
    });
    sinon.stub(AzureIdentity.DefaultAzureCredential.prototype, 'getToken').get(() => getAzureTokenMock);
    sinon.stub(GoogleAuth.prototype, 'getIdTokenClient').resolves({
      idTokenProvider: {
        fetchIdToken: getGcpTokenMock,
      },
    } as any);
  });

  afterEach(() => {
    cloudSdkStubs.reset();
    sinon.restore();
  });

  after(() => {
    rewiremock.disable();
  });

  it('throws error when instance is created without SF_ENABLE_EXPERIMENTAL_AUTHENTICATION=true', () => {
    sinon.stub(process, 'env').value({
      SF_ENABLE_EXPERIMENTAL_AUTHENTICATION: false
    });
    assert.throws(() => new AuthWorkloadIdentity(getConnectionConfig()), /Experimental Workload identity authentication is not enabled/);
  });

  it('reauthenticate() calls authenticate() and updates body with new token', async () => {
    const auth = new AuthWorkloadIdentity(getConnectionConfig());
    sinon
      .stub(auth, 'authenticate')
      .callsFake(async function (this: InstanceType<typeof AuthWorkloadIdentity>) {
        this.token = 'reauthenticated token';
      });
    const body: AuthRequestBody = { data: {} };
    await auth.reauthenticate(body);
    assert.strictEqual(body.data.TOKEN, 'reauthenticated token');
  });

  describe('authenticate() with auto-detect', () => {
    it('throws error when detection fails', async () => {
      const auth = new AuthWorkloadIdentity(getConnectionConfig());
      await assert.rejects(auth.authenticate(), /No workload identity credentials were found. Provider: auto-detect/);
    });

    it('uses OIDC when token is provided', async () => {
      const auth = new AuthWorkloadIdentity(getConnectionConfig({ token: 'test-token' }));
      await auth.authenticate();
      assert.strictEqual(auth.tokenProvider, 'OIDC');
      assert.strictEqual(auth.token, 'test-token');
    });

    it('uses AWS when AWS credentials are found', async () => {
      awsSdkMock.getCredentials.returns(AWS_CREDENTIALS);
      awsSdkMock.getMetadataRegion.returns(AWS_REGION);
      const auth = new AuthWorkloadIdentity(getConnectionConfig());
      await auth.authenticate();
      assert.strictEqual(auth.tokenProvider, 'AWS');
      assertAwsAttestationToken(auth.token, AWS_REGION);
    });

    it('uses AZURE when Azure credentials are found', async () => {
      getAzureTokenMock.returns({ token: 'test-token' });
      const auth = new AuthWorkloadIdentity(getConnectionConfig());
      await auth.authenticate();
      assert.strictEqual(auth.tokenProvider, 'AZURE');
      assert.strictEqual(auth.token, 'test-token');
    });

    it('uses GCP when GCP credentials are found', async () => {
      getGcpTokenMock.returns('test-token');
      const auth = new AuthWorkloadIdentity(getConnectionConfig());
      await auth.authenticate();
      assert.strictEqual(auth.tokenProvider, 'GCP');
      assert.strictEqual(auth.token, 'test-token');
    });
  });

  describe('authenticate() with OIDC', () => {
    const connectionConfig = getConnectionConfig({
      token: 'test-token',
      workloadIdentityProvider: 'OIDC'
    });

    it('throws error when token is not provided', async () => {
      const auth = new AuthWorkloadIdentity({ ...connectionConfig, token: undefined });
      await assert.rejects(auth.authenticate(), /No workload identity credentials were found. Provider: OIDC/);
    });

    it('sets valid fields for updateBody() to use', async () => {
      const auth = new AuthWorkloadIdentity(connectionConfig);
      const body: AuthRequestBody = { data: {} };
      await auth.authenticate();
      auth.updateBody(body);
      assert.strictEqual(body.data.AUTHENTICATOR, 'WORKLOAD_IDENTITY');
      assert.strictEqual(body.data.PROVIDER, 'OIDC');
      assert.strictEqual(body.data.TOKEN, connectionConfig.token);
    });
  });

  describe('authenticate() with AWS', () => {
    const connectionConfig = getConnectionConfig({
      workloadIdentityProvider: 'AWS'
    });

    it('throws error when credentials are not found', async () => {
      const auth = new AuthWorkloadIdentity(connectionConfig);
      await assert.rejects(auth.authenticate(), /No workload identity credentials were found. Provider: AWS/);
    });

    it('sets valid fields for updateBody() to use', async () => {
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

  describe('authenticate() with AZURE', () => {
    const connectionConfig = getConnectionConfig({
      workloadIdentityProvider: 'AZURE'
    });

    it('throws error when credentials are not found', async () => {
      getAzureTokenMock.throws(new Error('no credentials'));
      const auth = new AuthWorkloadIdentity(connectionConfig);
      await assert.rejects(auth.authenticate(), /No workload identity credentials were found. Provider: AZURE/);
    });

    it('sets valid fields for updateBody() to use', async () => {
      getAzureTokenMock.returns({ token: 'test-token' });
      const auth = new AuthWorkloadIdentity(connectionConfig);
      const body: AuthRequestBody = { data: {} };
      await auth.authenticate();
      auth.updateBody(body);
      assert.strictEqual(body.data.AUTHENTICATOR, 'WORKLOAD_IDENTITY');
      assert.strictEqual(body.data.PROVIDER, 'AZURE');
      assert.strictEqual(body.data.TOKEN, 'test-token');
    });
  });

  describe('authenticate() with GCP', () => {
    const connectionConfig = getConnectionConfig({
      workloadIdentityProvider: 'GCP'
    });

    it('throws error when credentials are not found', async () => {
      const auth = new AuthWorkloadIdentity(connectionConfig);
      await assert.rejects(auth.authenticate(), /No workload identity credentials were found. Provider: GCP/);
    });

    it('sets valid fields for updateBody() to use', async () => {
      getGcpTokenMock.returns('test-token');
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
