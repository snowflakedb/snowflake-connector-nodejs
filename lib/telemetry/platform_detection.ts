import http from 'node:http';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';

type Detector = (abortSignal: AbortSignal) => boolean | Promise<boolean>;

const AZURE_METADATA_BASE_URL = 'http://169.254.169.254';
const GCE_METADATA_ROOT_URL = 'http://metadata.google.internal';
const GCE_METADATA_BASE_URL = 'http://metadata.google.internal/computeMetadata/v1';

export const DETECTION_TIMEOUT_MS = 200;
const DETECTORS: Record<string, Detector> = {
  is_aws_lambda: isAwsLambda,
  is_azure_function: isAzureFunction,
  is_gce_cloud_run_service: isGceCloudRunService,
  is_gce_cloud_run_job: isGceCloudRunJob,
  is_github_action: isGithubAction,
  is_ec2_instance: isEc2Instance,
  has_aws_identity: hasAwsIdentity,
  is_azure_vm: isAzureVm,
  has_azure_managed_identity: hasAzureManagedIdentity,
  is_gce_vm: isGceVm,
  has_gcp_identity: hasGcpIdentity,
};

const DETECTION_RESULT = detectPlatforms();
export function getDetectedPlatforms(): Promise<string[]> {
  return DETECTION_RESULT;
}

async function detectPlatforms(): Promise<string[]> {
  if (process.env['SNOWFLAKE_DISABLE_PLATFORM_DETECTION']?.toLowerCase() === 'true') {
    return ['disabled'];
  }

  const abortSignal = AbortSignal.timeout(DETECTION_TIMEOUT_MS);
  const results = await Promise.all(
    Object.entries(DETECTORS).map(async ([name, detector]) => ({
      name,
      detected: await Promise.resolve(detector(abortSignal)).catch(() => false),
    })),
  );

  return results.filter(({ detected }) => detected).map(({ name }) => name);
}

function isAwsLambda(): boolean {
  return envPresent('LAMBDA_TASK_ROOT');
}

function isAzureFunction(): boolean {
  return envPresent(
    'FUNCTIONS_WORKER_RUNTIME',
    'FUNCTIONS_EXTENSION_VERSION',
    'AzureWebJobsStorage',
  );
}

function isGceCloudRunService(): boolean {
  return envPresent('K_SERVICE', 'K_REVISION', 'K_CONFIGURATION');
}

function isGceCloudRunJob(): boolean {
  return envPresent('CLOUD_RUN_JOB', 'CLOUD_RUN_EXECUTION');
}

function isGithubAction(): boolean {
  return envPresent('GITHUB_ACTIONS');
}

async function isEc2Instance(abortSignal: AbortSignal): Promise<boolean> {
  const result = await httpGet(
    'http://169.254.169.254/latest/dynamic/instance-identity/document',
    abortSignal,
  );
  if (!result.ok) return false;
  const doc = JSON.parse(result.body) as { instanceId?: string };
  return !!doc.instanceId;
}

async function hasAwsIdentity(abortSignal: AbortSignal): Promise<boolean> {
  const client = new STSClient({});
  const response = await client.send(new GetCallerIdentityCommand({}), {
    abortSignal,
  });
  if (!response.Arn) return false;
  return isValidArnForWif(response.Arn);
}

async function isAzureVm(abortSignal: AbortSignal): Promise<boolean> {
  const result = await httpGet(
    `${AZURE_METADATA_BASE_URL}/metadata/instance?api-version=2019-03-11`,
    abortSignal,
    { Metadata: 'true' },
  );
  return result.ok;
}

async function hasAzureManagedIdentity(abortSignal: AbortSignal): Promise<boolean> {
  if (isAzureFunction() && envPresent('IDENTITY_HEADER')) {
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
}

async function isGceVm(abortSignal: AbortSignal): Promise<boolean> {
  const result = await httpGet(GCE_METADATA_ROOT_URL, abortSignal);
  return result.headers['metadata-flavor'] === 'Google';
}

async function hasGcpIdentity(abortSignal: AbortSignal): Promise<boolean> {
  const result = await httpGet(
    `${GCE_METADATA_BASE_URL}/instance/service-accounts/default/email`,
    abortSignal,
    { 'Metadata-Flavor': 'Google' },
  );
  return result.ok;
}

/*
 * We intentionally avoid using fetch() here, since aborting fetch requests
 * can sometimes leave sockets open and prevent the Node.js process from exiting (tested on 22).
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

function isValidArnForWif(arn: string): boolean {
  return [/^arn:[^:]+:iam::[^:]+:user\/.+$/, /^arn:[^:]+:sts::[^:]+:assumed-role\/.+$/].some(
    (pattern) => pattern.test(arn),
  );
}
