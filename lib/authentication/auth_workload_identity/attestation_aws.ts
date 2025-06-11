import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { MetadataService } from '@aws-sdk/ec2-metadata-service';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import Logger from '../../logger';

async function getAwsCredentials() {
  try {
    return await defaultProvider()();
  } catch (error) {
    Logger().debug("No AWS credentials were found.");
    return null;
  }
}

async function getAwsRegion() {
  if (process.env.AWS_REGION) {
    return process.env.AWS_REGION; // Lambda
  } else {
    try {
      return await new MetadataService().request('/latest/meta-data/placement/region', {}) // EC2
    } catch (error) {
      Logger().debug("No AWS region was found.");
      return null;
    }
  }
}

async function getAwsArn(region: string) {
  try {
    const stsClient = new STSClient({ region });
    const command = new GetCallerIdentityCommand({});
    const response = await stsClient.send(command);
    return response.Arn;
  } catch (error) {
    Logger().debug("No AWS caller identity was found.");
    return null;
  }
}

/**
 * Tries to create a workload identity attestation for AWS.
 * If the application isn't running on AWS or no credentials were found, returns null.
 */
export async function getAwsAttestationToken() {
  const credentials = await getAwsCredentials();
  if (!credentials) {
    return null;
  }

  const region = await getAwsRegion();
  if (!region) {
    return null;
  }

  const arn = await getAwsArn(region);
  if (!arn) {
    return null;
  }

  const stsHostname = `sts.${region}.amazonaws.com`;
  const request = new HttpRequest({
    method: 'POST',
    protocol: 'https',
    hostname: stsHostname,
    path: '/',
    headers: {
      'host': stsHostname,
      'x-snowflake-audience': 'snowflakecomputing.com'
    },
    query: {
      'Action': 'GetCallerIdentity',
      'Version': '2011-06-15'
    }
  });
  const signedRequest = await new SignatureV4({
    credentials,
    applyChecksum: false,
    region,
    service: 'sts',
    sha256: Sha256
  }).sign(request);


  const token = {
    url: `https://${stsHostname}/?Action=GetCallerIdentity&Version=2011-06-15`,
    method: 'POST',
    headers: signedRequest.headers
  };
  console.log(stsHostname, token);
  return btoa(JSON.stringify(token));
}
