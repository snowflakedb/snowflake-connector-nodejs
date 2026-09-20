import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { STSClient, AssumeRoleCommand, GetWebIdentityTokenCommand } from '@aws-sdk/client-sts';
import { MetadataService } from '@aws-sdk/ec2-metadata-service';
import { HttpRequest } from '@smithy/protocol-http';
import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import Logger from '../../logger';

export async function getAwsCredentials(
  region: string,
  impersonationPath: string[] = [],
  customStsEndpoint?: URL,
) {
  Logger().debug('Getting AWS credentials from default provider');
  let credentials = await defaultProvider()();

  for (const roleArn of impersonationPath) {
    Logger().debug(`Getting AWS credentials from impersonation role: ${roleArn}`);
    const stsClient = new STSClient({
      credentials,
      region,
      ...stsClientEndpointConfig(customStsEndpoint),
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

export function getStsHostname(region: string) {
  const domain = region.startsWith('cn-') ? 'amazonaws.com.cn' : 'amazonaws.com';
  return `sts.${region}.${domain}`;
}

/**
 * Normalizes a user-supplied `workloadIdentityHost`. Accepts a bare host, a host:port or a
 * full URL; the value is used as given, without any partition suffix mapping.
 */
export function parseWorkloadIdentityHost(workloadIdentityHost: string): URL {
  const trimmed = workloadIdentityHost.trim();
  if (!trimmed) {
    throw new Error('workloadIdentityHost is empty');
  }

  const withScheme = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new Error(`Invalid workloadIdentityHost "${trimmed}": malformed URL`);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(
      `Invalid workloadIdentityHost "${trimmed}": must use https or http, got scheme "${url.protocol.slice(0, -1)}"`,
    );
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      `Invalid workloadIdentityHost "${trimmed}": must not contain user info, a query or a fragment`,
    );
  }

  url.pathname = url.pathname.replace(/\/+$/, '');
  return url;
}

function stsClientEndpointConfig(customStsEndpoint?: URL) {
  // Without an override the SDK resolves the STS endpoint itself, honoring its own
  // FIPS/dualstack settings.
  if (!customStsEndpoint) {
    return {};
  }

  if (process.env.AWS_USE_FIPS_ENDPOINT || process.env.AWS_USE_DUALSTACK_ENDPOINT) {
    Logger().warn(
      'workloadIdentityHost is set, so FIPS and dualstack endpoint preferences are ignored for STS requests',
    );
  }

  // FIPS and dualstack are endpoint-selection inputs, not crypto settings, and the SDK
  // endpoint resolver rejects them when combined with a custom endpoint.
  return {
    endpoint: { url: customStsEndpoint },
    useFipsEndpoint: false,
    useDualstackEndpoint: false,
  };
}

export async function getAwsAttestationToken({
  useOutboundToken = false,
  impersonationPath,
  workloadIdentityHost,
}: {
  useOutboundToken?: boolean;
  impersonationPath?: string[];
  workloadIdentityHost?: string;
} = {}) {
  // Parsed up front so that a malformed override fails with a configuration error instead
  // of a region or credentials error.
  const customStsEndpoint = workloadIdentityHost
    ? parseWorkloadIdentityHost(workloadIdentityHost)
    : undefined;

  const region = await getAwsRegion();
  if (customStsEndpoint) {
    Logger().debug(`Using explicit STS endpoint for AWS attestation: ${customStsEndpoint.href}`);
  }

  const credentials = await getAwsCredentials(region, impersonationPath, customStsEndpoint);

  if (useOutboundToken) {
    return getOutboundWebIdentityToken(region, credentials, customStsEndpoint);
  } else {
    const stsEndpoint = customStsEndpoint ?? new URL(`https://${getStsHostname(region)}`);
    return getCallerIdentityToken(region, credentials, stsEndpoint);
  }
}

async function getCallerIdentityToken(
  region: string,
  credentials: Awaited<ReturnType<typeof getAwsCredentials>>,
  stsEndpoint: URL,
) {
  const request = new HttpRequest({
    method: 'POST',
    protocol: stsEndpoint.protocol,
    hostname: stsEndpoint.hostname,
    port: stsEndpoint.port ? Number(stsEndpoint.port) : undefined,
    path: stsEndpoint.pathname,
    headers: {
      host: stsEndpoint.host,
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
    url: `${stsEndpoint.origin}${stsEndpoint.pathname}?Action=GetCallerIdentity&Version=2011-06-15`,
    method: 'POST',
    headers: signedRequest.headers,
  };
  return btoa(JSON.stringify(token));
}

async function getOutboundWebIdentityToken(
  region: string,
  credentials: Awaited<ReturnType<typeof getAwsCredentials>>,
  customStsEndpoint?: URL,
) {
  const stsClient = new STSClient({
    credentials,
    region,
    ...stsClientEndpointConfig(customStsEndpoint),
  });
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

  return token;
}
