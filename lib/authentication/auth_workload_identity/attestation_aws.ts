import Logger from '../../logger';
let defaultProvider: typeof import('@aws-sdk/credential-provider-node') | null = null;
let MetadataService: typeof import('@aws-sdk/ec2-metadata-service').MetadataService | null = null;
let HttpRequest: typeof import('@aws-sdk/protocol-http').HttpRequest | null = null;
let SignatureV4: typeof import('@aws-sdk/signature-v4').SignatureV4 | null = null;
let Sha256: typeof import('@aws-crypto/sha256-js').Sha256 | null = null;

try {
  defaultProvider = require('@aws-sdk/credential-provider-node');
  MetadataService = require('@aws-sdk/ec2-metadata-service');
  HttpRequest = require('@aws-sdk/protocol-http');
  SignatureV4 = require('@aws-sdk/signature-v4');
  Sha256 = require('@aws-crypto/sha256-js');
} catch (error) {
  Logger().info(
    'one of @aws-sdk workload identity packages is not installed, skipping aws-sdk workload identity features.',
  );
}

export async function getAwsCredentials() {
  try {
    Logger().debug('Getting AWS credentials from default provider');
    return await defaultProvider?.defaultProvider()();
  } catch (error) {
    Logger().debug('No AWS credentials were found.');
    return null;
  }
}

export async function getAwsRegion() {
  if (process.env.AWS_REGION) {
    Logger().debug('Getting AWS region from AWS_REGION');
    return process.env.AWS_REGION; // Lambda
  } else {
    try {
      Logger().debug('Getting AWS region from EC2 metadata service');
      if (MetadataService != null) {
        return await new MetadataService().request('/latest/meta-data/placement/region', {}); // EC2
      } else {
        Logger().debug(`EC2 metadata service package does not exist. Return null`);
        return null;
      }
    } catch (error) {
      Logger().debug(`Failed to fetch AWS region from EC2 metadata service: ${error}`);
      return null;
    }
  }
}

export function getStsHostname(region: string) {
  const domain = region.startsWith('cn-') ? 'amazonaws.com.cn' : 'amazonaws.com';
  return `sts.${region}.${domain}`;
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

  const stsHostname = getStsHostname(region);
  if (HttpRequest != null && SignatureV4 != null && Sha256 != null) {
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
  } else {
    Logger().debug(`HttpRequest, SignatureV4, and Sha256 packages do not exist. Return null`);
    return null;
  }
}
