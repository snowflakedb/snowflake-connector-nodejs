import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { STSClient, AssumeRoleCommand, GetWebIdentityTokenCommand } from '@aws-sdk/client-sts';
import { MetadataService } from '@aws-sdk/ec2-metadata-service';
import Logger from '../../logger';

export async function getAwsCredentials(region: string, impersonationPath: string[] = []) {
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
  if (process.env.AWS_REGION) {
    Logger().debug('Getting AWS region from AWS_REGION');
    return process.env.AWS_REGION; // Lambda
  } else {
    Logger().debug('Getting AWS region from EC2 metadata service');
    return new MetadataService().request('/latest/meta-data/placement/region', {}); // EC2
  }
}

export async function getAwsAttestationToken(impersonationPath?: string[]) {
  const region = await getAwsRegion();
  const credentials = await getAwsCredentials(region, impersonationPath);

  const stsClient = new STSClient({ credentials, region });
  const response = await stsClient.send(
    new GetWebIdentityTokenCommand({
      Audience: ['snowflakecomputing.com'],
      SigningAlgorithm: 'ES384',
    }),
  );

  const token = response.WebIdentityToken;
  if (!token) {
    throw new Error('Failed to obtain AWS web identity token from STS');
  }

  Logger().debug(`AWS outbound token prefix: ${token.slice(0, 10)}`);
  return token;
}
