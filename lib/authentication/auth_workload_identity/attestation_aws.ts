import Logger from '../../logger';

export async function getAwsCredentials(region: string, impersonationPath: string[] = []) {
  // @ts-ignore
  const defaultProvider = await import('@aws-sdk/credential-provider-node').then(
    (i) => i.defaultProvider,
  );
  // @ts-ignore
  const { STSClient, AssumeRoleCommand } = await import('@aws-sdk/client-sts').then((i) => ({
    STSClient: i.STSClient,
    AssumeRoleCommand: i.AssumeRoleCommand,
  }));

  Logger().debug('Getting AWS credentials from default provider');
  let credentials = await defaultProvider()();

  for (const roleArn of impersonationPath) {
    Logger().debug(`Getting AWS credentials from impersonation role: ${roleArn}`);
    const stsClient = new STSClient({
      credentials,
      region,
    });
    const command = new AssumeRoleCommand({
      RoleArn: roleArn,
      RoleSessionName: 'identity-federation-session',
    });
    const { Credentials } = await stsClient.send(command);
    if (Credentials?.AccessKeyId && Credentials?.SecretAccessKey) {
      credentials = {
        accessKeyId: Credentials.AccessKeyId,
        secretAccessKey: Credentials.SecretAccessKey,
        sessionToken: Credentials.SessionToken,
      };
    } else {
      throw new Error(`Failed to get credentials from impersonation role ${roleArn}`);
    }
  }

  return credentials;
}

export async function getAwsRegion() {
  // @ts-ignore
  const MetadataService = await import('@aws-sdk/ec2-metadata-service').then(
    (i) => i.MetadataService,
  );

  if (process.env.AWS_REGION) {
    Logger().debug('Getting AWS region from AWS_REGION');
    return process.env.AWS_REGION; // Lambda
  } else {
    Logger().debug('Getting AWS region from EC2 metadata service');
    return new MetadataService().request('/latest/meta-data/placement/region', {}); // EC2
  }
}

export function getStsHostname(region: string) {
  const domain = region.startsWith('cn-') ? 'amazonaws.com.cn' : 'amazonaws.com';
  return `sts.${region}.${domain}`;
}

export async function getAwsAttestationToken(impersonationPath?: string[]) {
  // @ts-ignore
  const HttpRequest = await import('@smithy/protocol-http').then((i) => i.HttpRequest);
  // @ts-ignore
  const SignatureV4 = await import('@smithy/signature-v4').then((i) => i.SignatureV4);
  // @ts-ignore
  const Sha256 = await import('@aws-crypto/sha256-js').then((i) => i.Sha256);

  const region = await getAwsRegion();
  const credentials = await getAwsCredentials(region, impersonationPath);

  const stsHostname = getStsHostname(region);
  const request = new HttpRequest({
    method: 'POST',
    protocol: 'https',
    hostname: stsHostname,
    path: '/',
    headers: {
      host: stsHostname,
      'x-snowflake-audience': 'snowflakecomputing.com',
    },
    query: {
      Action: 'GetCallerIdentity',
      Version: '2011-06-15',
    },
  });
  const signedRequest = await new SignatureV4({
    credentials,
    applyChecksum: false,
    region,
    service: 'sts',
    sha256: Sha256,
  }).sign(request);

  const token = {
    url: `https://${stsHostname}/?Action=GetCallerIdentity&Version=2011-06-15`,
    method: 'POST',
    headers: signedRequest.headers,
  };
  return btoa(JSON.stringify(token));
}
