import sinon, { SinonSandbox } from 'sinon';
import mock from 'mock-require';
import assert from 'assert';
import { WIP_ConnectionConfig } from '../../../lib/connection/types';
import { AuthRequestBody } from '../../../lib/authentication/types';

// NOTE:
// Sinon can't stub frozen AWS SDK properties, so we need to mock entire require
const sinonSandbox = sinon.createSandbox();
const awsSdkStub = {
  getCredentials: sinonSandbox.stub(),
  getRegion: sinonSandbox.stub(),
};
mock('@aws-sdk/credential-provider-node', {
  defaultProvider: () => awsSdkStub.getCredentials
});
mock('@aws-sdk/ec2-metadata-service', {
  MetadataService: class {
    request = () => awsSdkStub.getRegion();
  }
});
import AuthWorkloadIdentity from '../../../lib/authentication/auth_workload_identity';


describe('Workload Identity for AWS', () => {
  const AWS_REGION = 'test-aws-region';
  const connectionConfig: WIP_ConnectionConfig = {
    workloadIdentityProvider: 'AWS',
    enableExperimentalWorkloadIdentityAuth: true,
  };

  beforeEach(() => {
    awsSdkStub.getCredentials.returns({
      accessKeyId: 'dummy key id',
      secretAccessKey: 'dummy secret key',
      sessionToken: 'dummy session token',
    });
    awsSdkStub.getRegion.returns(AWS_REGION);
  });

  afterEach(() => {
    sinonSandbox.restore();
  });

  it('throws error when instance is created without enableExperimentalWorkloadIdentityAuth', () => {
    assert.throws(() => new AuthWorkloadIdentity({
      ...connectionConfig,
      enableExperimentalWorkloadIdentityAuth: undefined,
    }), /Experimental Workload identity authentication is not enabled/);
  });

  it('authenticate method is thenable', done=> {
    const auth = new AuthWorkloadIdentity(connectionConfig);
    auth.authenticate().then(done).catch(done);
  });

  it('updateBody raises error when no credentials are found', async () => {
    awsSdkStub.getCredentials.returns(null);
    const auth = new AuthWorkloadIdentity(connectionConfig);
    const body: AuthRequestBody = { data: {} };
    await assert.rejects(auth.updateBody(body), /No workload identity credentials were found. Provider: AWS/);
  });

  it('updateBody sets valid body fields', async () => {
    const auth = new AuthWorkloadIdentity(connectionConfig);
    const body: AuthRequestBody = { data: {} };
    await auth.updateBody(body);

    assert.strictEqual(body.data.AUTHENTICATOR, 'WORKLOAD_IDENTITY');
    assert.strictEqual(body.data.PROVIDER, 'AWS');

    const decodedToken = JSON.parse(atob(body.data.TOKEN));
    const parsedUrl = new URL(decodedToken.url);
    assert.strictEqual(parsedUrl.hostname, `sts.${AWS_REGION}.amazonaws.com`);
    assert.strictEqual(parsedUrl.searchParams.get('Action'), 'GetCallerIdentity');
    assert.strictEqual(parsedUrl.searchParams.get('Version'), '2011-06-15');
    assert.strictEqual(decodedToken.method, 'POST');
    assert.deepStrictEqual(
      Object.keys(decodedToken.headers),
      [
        'host',
        'x-snowflake-audience',
        'x-amz-date',
        'x-amz-security-token',
        'authorization'
      ]
    );
    assert.strictEqual(decodedToken.headers.host, `sts.${AWS_REGION}.amazonaws.com`);
    assert.strictEqual(decodedToken.headers['x-snowflake-audience'], 'snowflakecomputing.com');
  });
});
