import http from 'node:http';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';

const AZURE_METADATA_BASE_URL = 'http://169.254.169.254';
const GCE_METADATA_ROOT_URL = 'http://metadata.google.internal';
const GCE_METADATA_BASE_URL = 'http://metadata.google.internal/computeMetadata/v1';

export type Detector = (abortSignal: AbortSignal) => boolean | Promise<boolean>;

export const DETECTORS: Record<string, Detector> = {
  is_aws_lambda: () => envPresent('LAMBDA_TASK_ROOT'),

  is_azure_function: () =>
    envPresent('FUNCTIONS_WORKER_RUNTIME', 'FUNCTIONS_EXTENSION_VERSION', 'AzureWebJobsStorage'),

  is_gce_cloud_run_service: () => envPresent('K_SERVICE', 'K_REVISION', 'K_CONFIGURATION'),

  is_gce_cloud_run_job: () => envPresent('CLOUD_RUN_JOB', 'CLOUD_RUN_EXECUTION'),

  is_github_action: () => envPresent('GITHUB_ACTIONS'),

  is_ec2_instance: async (abortSignal) => {
    const result = await httpGet(
      'http://169.254.169.254/latest/dynamic/instance-identity/document',
      abortSignal,
    );
    if (!result.ok) return false;
    const doc = JSON.parse(result.body) as { instanceId?: string };
    return !!doc.instanceId;
  },

  has_aws_identity: async (abortSignal) => {
    const client = new STSClient({});
    const response = await client.send(new GetCallerIdentityCommand({}), {
      abortSignal,
    });
    if (!response.Arn) return false;
    return isValidArnForWif(response.Arn);
  },

  is_azure_vm: async (abortSignal) => {
    const result = await httpGet(
      `${AZURE_METADATA_BASE_URL}/metadata/instance?api-version=2019-03-11`,
      abortSignal,
      { Metadata: 'true' },
    );
    return result.ok;
  },

  has_azure_managed_identity: async (abortSignal) => {
    if (
      envPresent(
        'FUNCTIONS_WORKER_RUNTIME',
        'FUNCTIONS_EXTENSION_VERSION',
        'AzureWebJobsStorage',
        'IDENTITY_HEADER',
      )
    ) {
      return true;
    }
    const params = new URLSearchParams({
      'api-version': '2018-02-01',
      resource: 'https://management.azure.com',
    });
    const result = await httpGet(
      `${AZURE_METADATA_BASE_URL}/metadata/identity/oauth2/token?${params}`,
      abortSignal,
      { Metadata: 'true' },
    );
    return result.ok;
  },

  is_gce_vm: async (abortSignal) => {
    const result = await httpGet(GCE_METADATA_ROOT_URL, abortSignal);
    return result.headers['metadata-flavor'] === 'Google';
  },

  has_gcp_identity: async (abortSignal) => {
    const result = await httpGet(
      `${GCE_METADATA_BASE_URL}/instance/service-accounts/default/email`,
      abortSignal,
      { 'Metadata-Flavor': 'Google' },
    );
    return result.ok;
  },
};

/*
 * NOTE:
 * We intentionally avoid using fetch() here, since aborting fetch requests
 * can sometimes leave sockets open and prevent the Node.js process from exiting (tested on 22).
 *
 * Example of a lingering socket:
 * Socket {
 *   ...
 *   localAddress: 192.168.1.131,
 *   localPort: 56877
 * }
 */
function httpGet(
  url: string,
  signal: AbortSignal,
  headers?: Record<string, string>,
): Promise<{
  ok: boolean;
  headers: http.IncomingHttpHeaders;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { signal, headers }, (res) => {
      let body = '';
      const statusCode = res.statusCode ?? 0;
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () =>
        resolve({ ok: statusCode >= 200 && statusCode < 300, headers: res.headers, body }),
      );
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

function envPresent(...envVars: string[]): boolean {
  return envVars.every((v) => {
    const val = process.env[v];
    return val !== undefined && val !== '';
  });
}

export function isValidArnForWif(arn: string): boolean {
  return [/^arn:[^:]+:iam::[^:]+:user\/.+$/, /^arn:[^:]+:sts::[^:]+:assumed-role\/.+$/].some(
    (pattern) => pattern.test(arn),
  );
}
