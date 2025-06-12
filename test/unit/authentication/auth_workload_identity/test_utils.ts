import assert from 'assert';
import { SinonSandbox } from 'sinon';
import rewiremock from 'rewiremock/node';

export const AWS_REGION = 'test-region';
export const AWS_CREDENTIALS = {
  accessKeyId: 'test',
  secretAccessKey: 'test',
  sessionToken: 'test',
};

/**
 * Mocks AWS SDK dependencies used by attestation_aws.ts
 *
 * Must be called before importing dependent files.
 * Make sure to restore the mock in after() hook so it doesn't affect other test files.
 * ```
 * after(() => {
 *   awsSdkStub.restore();
 * });
 * ```
 */
export function mockAwsSdk(sinonSandbox: SinonSandbox) {
  const awsSdkStub = {
    getCredentials: sinonSandbox.stub(),
    getRegion: sinonSandbox.stub(),
  };

  // NOTE:
  // Sinon can't stub frozen AWS SDK properties, so we need to mock entire require
  rewiremock('@aws-sdk/credential-provider-node').with({
    defaultProvider: () => awsSdkStub.getCredentials,
  })
  rewiremock('@aws-sdk/ec2-metadata-service').with({
    MetadataService: class {
      request = () => awsSdkStub.getRegion();
    }
  });
  rewiremock.enable();

  return {
    credentials: {
      returnsNotFound: () => awsSdkStub.getCredentials.throws(new Error('No credentials found')),
      returnsValid: () => awsSdkStub.getCredentials.returns(AWS_CREDENTIALS)
    },
    metadataRegion: {
      returnsNotFound: () => awsSdkStub.getRegion.throws(new Error('No region found')),
      returnsValid: () => awsSdkStub.getRegion.returns(AWS_REGION)
    },
    restore: rewiremock.disable,
  }
}

export function assertAwsAttestationToken(token: string | null) {
  if (!token) {
    assert.fail('Token is null');
  }
  const decodedToken = JSON.parse(atob(token));
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
}
