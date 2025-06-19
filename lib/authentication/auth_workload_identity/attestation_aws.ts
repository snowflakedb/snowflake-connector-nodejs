import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { MetadataService } from '@aws-sdk/ec2-metadata-service';
import { HttpRequest } from '@aws-sdk/protocol-http';
import { SignatureV4 } from '@aws-sdk/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import Logger from '../../logger';

export async function getAwsCredentials() {
  try {
    Logger().debug("Getting AWS credentials from default provider");
    return await defaultProvider()();
  } catch (error) {
    Logger().debug("No AWS credentials were found.");
    return null;
  }
}

export async function getAwsRegion() {
  if (process.env.AWS_REGION) {
    Logger().debug("Getting AWS region from AWS_REGION");
    return process.env.AWS_REGION; // Lambda
  } else {
    try {
      Logger().debug("Getting AWS region from EC2 metadata service");
      return await new MetadataService().request('/latest/meta-data/placement/region', {}) // EC2
    } catch (error) {
      Logger().debug(`Failed to fetch AWS region from EC2 metadata service: ${error}`);
      return null;
    }
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
  return btoa(JSON.stringify(token));
}
