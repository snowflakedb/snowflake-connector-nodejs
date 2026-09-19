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
  stsEndpoint?: StsEndpoint,
) {
  Logger().debug('Getting AWS credentials from default provider');
  let credentials = await defaultProvider()();

  for (const roleArn of impersonationPath) {
    Logger().debug(`Getting AWS credentials from impersonation role: ${roleArn}`);
    const stsClient = new STSClient({
      credentials,
      region,
      ...stsClientEndpointConfig(stsEndpoint),
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
 * STS endpoint the AWS Workload Identity flows talk to. Either the one derived from the region
 * or the verbatim `workloadIdentityHost` override, which lets AWS partitions unknown to the
 * driver be reached.
 */
export type StsEndpoint = {
  /** host[:port], used as the SigV4-signed `Host` header */
  authority: string;
  /** bare hostname, without port */
  hostname: string;
  /** port, when the override specifies a non-default one */
  port?: number;
  /** 'https:' or 'http:' */
  protocol: string;
  /** path prefix without a trailing slash, empty for the common case */
  path: string;
  /** protocol + authority + path, used as the AWS SDK `endpoint` */
  baseUrl: string;
  /** whether workloadIdentityHost was set, as opposed to the regional default */
  overridden: boolean;
};

export function regionalStsEndpoint(region: string): StsEndpoint {
  const hostname = getStsHostname(region);
  return {
    authority: hostname,
    hostname,
    protocol: 'https:',
    path: '',
    baseUrl: `https://${hostname}`,
    overridden: false,
  };
}

/**
 * Normalizes a user-supplied `workloadIdentityHost`. Accepts a bare host, a host:port or a
 * full URL; the value is used as given, without any partition suffix mapping.
 */
export function parseWorkloadIdentityHost(workloadIdentityHost: string): StsEndpoint {
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
  if (!url.hostname) {
    throw new Error(`Invalid workloadIdentityHost "${trimmed}": does not contain a hostname`);
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(
      `Invalid workloadIdentityHost "${trimmed}": must not contain user info, a query or a fragment`,
    );
  }

  const path = url.pathname.replace(/\/+$/, '');
  return {
    authority: url.host,
    hostname: url.hostname,
    port: url.port ? Number(url.port) : undefined,
    protocol: url.protocol,
    path,
    baseUrl: `${url.protocol}//${url.host}${path}`,
    overridden: true,
  };
}

function stsClientEndpointConfig(stsEndpoint?: StsEndpoint) {
  // Without an override the SDK resolves the STS endpoint itself, honoring its own
  // FIPS/dualstack settings.
  if (!stsEndpoint?.overridden) {
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
    endpoint: stsEndpoint.baseUrl,
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
  const endpointOverride = workloadIdentityHost
    ? parseWorkloadIdentityHost(workloadIdentityHost)
    : undefined;

  const region = await getAwsRegion();
  const stsEndpoint = endpointOverride ?? regionalStsEndpoint(region);
  if (stsEndpoint.overridden) {
    Logger().debug(`Using explicit STS endpoint for AWS attestation: ${stsEndpoint.baseUrl}`);
  }

  const credentials = await getAwsCredentials(region, impersonationPath, stsEndpoint);

  if (useOutboundToken) {
    return getOutboundWebIdentityToken(region, credentials, stsEndpoint);
  } else {
    return getCallerIdentityToken(region, credentials, stsEndpoint);
  }
}

async function getCallerIdentityToken(
  region: string,
  credentials: Awaited<ReturnType<typeof getAwsCredentials>>,
  stsEndpoint: StsEndpoint,
) {
  const request = new HttpRequest({
    method: 'POST',
    protocol: stsEndpoint.protocol,
    hostname: stsEndpoint.hostname,
    port: stsEndpoint.port,
    path: stsEndpoint.path || '/',
    headers: {
      host: stsEndpoint.authority,
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
    url: `${stsEndpoint.baseUrl}${stsEndpoint.path ? '' : '/'}?Action=GetCallerIdentity&Version=2011-06-15`,
    method: 'POST',
    headers: signedRequest.headers,
  };
  return btoa(JSON.stringify(token));
}

async function getOutboundWebIdentityToken(
  region: string,
  credentials: Awaited<ReturnType<typeof getAwsCredentials>>,
  stsEndpoint: StsEndpoint,
) {
  const stsClient = new STSClient({
    credentials,
    region,
    ...stsClientEndpointConfig(stsEndpoint),
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
