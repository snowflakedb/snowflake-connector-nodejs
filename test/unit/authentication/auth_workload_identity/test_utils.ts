import assert from 'assert';

export const AWS_REGION = 'test-region';
export const AWS_CREDENTIALS = {
  accessKeyId: 'test',
  secretAccessKey: 'test',
  sessionToken: 'test',
};

export function assertAwsAttestationToken(token: string | null | undefined, region: string) {
  if (!token) {
    assert.fail('Token is empty');
  }
  const decodedToken = JSON.parse(atob(token));
  const parsedUrl = new URL(decodedToken.url);
  assert.strictEqual(parsedUrl.hostname, `sts.${region}.amazonaws.com`);
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
  assert.strictEqual(decodedToken.headers.host, `sts.${region}.amazonaws.com`);
  assert.strictEqual(decodedToken.headers['x-snowflake-audience'], 'snowflakecomputing.com');
}
