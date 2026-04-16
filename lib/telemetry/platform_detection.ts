import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';

const DETECTION_TIMEOUT_MS = 200;
const DISABLE_ENV = 'SNOWFLAKE_DISABLE_PLATFORM_DETECTION';

const AZURE_METADATA_BASE_URL = 'http://169.254.169.254';
const GCE_METADATA_ROOT_URL = 'http://metadata.google.internal';
const GCE_METADATA_BASE_URL = 'http://metadata.google.internal/computeMetadata/v1';

interface DetectorEntry {
  name: string;
  detector: () => boolean;
}

interface AsyncDetectorEntry {
  name: string;
  detector: () => Promise<boolean>;
}

const ENV_DETECTORS: DetectorEntry[] = [
  {
    name: 'is_aws_lambda',
    detector: () => areAllEnvVarsPresent('LAMBDA_TASK_ROOT'),
  },
  {
    name: 'is_azure_function',
    detector: () =>
      areAllEnvVarsPresent(
        'FUNCTIONS_WORKER_RUNTIME',
        'FUNCTIONS_EXTENSION_VERSION',
        'AzureWebJobsStorage',
      ),
  },
  {
    name: 'is_gce_cloud_run_service',
    detector: () => areAllEnvVarsPresent('K_SERVICE', 'K_REVISION', 'K_CONFIGURATION'),
  },
  {
    name: 'is_gce_cloud_run_job',
    detector: () => areAllEnvVarsPresent('CLOUD_RUN_JOB', 'CLOUD_RUN_EXECUTION'),
  },
  {
    name: 'is_github_action',
    detector: () => areAllEnvVarsPresent('GITHUB_ACTIONS'),
  },
];

const ASYNC_DETECTORS: AsyncDetectorEntry[] = [
  { name: 'is_ec2_instance', detector: detectEc2Instance },
  { name: 'has_aws_identity', detector: detectAwsIdentity },
  { name: 'is_azure_vm', detector: detectAzureVM },
  { name: 'has_azure_managed_identity', detector: detectAzureManagedIdentity },
  { name: 'is_gce_vm', detector: detectGceVM },
  { name: 'has_gcp_identity', detector: detectGcpIdentity },
];

function areAllEnvVarsPresent(...envVars: string[]): boolean {
  return envVars.every((envVar) => {
    const value = process.env[envVar];
    return value !== undefined && value !== '';
  });
}

export function isValidArnForWif(arn: string): boolean {
  return [/^arn:[^:]+:iam::[^:]+:user\/.+$/, /^arn:[^:]+:sts::[^:]+:assumed-role\/.+$/].some(
    (pattern) => pattern.test(arn),
  );
}

async function detectEc2Instance(): Promise<boolean> {
  const response = await fetch('http://169.254.169.254/latest/dynamic/instance-identity/document', {
    signal: AbortSignal.timeout(DETECTION_TIMEOUT_MS),
  });
  if (!response.ok) return false;
  const doc = (await response.json()) as { instanceId?: string };
  return !!doc.instanceId;
}

async function detectAwsIdentity(): Promise<boolean> {
  const client = new STSClient({});
  const response = await client.send(new GetCallerIdentityCommand({}), {
    abortSignal: AbortSignal.timeout(DETECTION_TIMEOUT_MS),
  });
  if (!response.Arn) return false;
  return isValidArnForWif(response.Arn);
}

async function detectAzureVM(): Promise<boolean> {
  const response = await fetch(
    `${AZURE_METADATA_BASE_URL}/metadata/instance?api-version=2019-03-11`,
    { headers: { Metadata: 'true' }, signal: AbortSignal.timeout(DETECTION_TIMEOUT_MS) },
  );
  return response.ok;
}

async function detectAzureManagedIdentity(): Promise<boolean> {
  if (
    areAllEnvVarsPresent(
      'FUNCTIONS_WORKER_RUNTIME',
      'FUNCTIONS_EXTENSION_VERSION',
      'AzureWebJobsStorage',
    ) &&
    areAllEnvVarsPresent('IDENTITY_HEADER')
  ) {
    return true;
  }
  const params = new URLSearchParams({
    'api-version': '2018-02-01',
    resource: 'https://management.azure.com',
  });
  const response = await fetch(
    `${AZURE_METADATA_BASE_URL}/metadata/identity/oauth2/token?${params}`,
    { headers: { Metadata: 'true' }, signal: AbortSignal.timeout(DETECTION_TIMEOUT_MS) },
  );
  return response.ok;
}

async function detectGceVM(): Promise<boolean> {
  const response = await fetch(GCE_METADATA_ROOT_URL, {
    signal: AbortSignal.timeout(DETECTION_TIMEOUT_MS),
  });
  return response.headers.get('metadata-flavor') === 'Google';
}

async function detectGcpIdentity(): Promise<boolean> {
  const response = await fetch(`${GCE_METADATA_BASE_URL}/instance/service-accounts/default/email`, {
    headers: { 'Metadata-Flavor': 'Google' },
    signal: AbortSignal.timeout(DETECTION_TIMEOUT_MS),
  });
  return response.ok;
}

function withTimeout(promise: Promise<boolean>, timeoutMs: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs);
    promise.then(
      (result) => {
        clearTimeout(timer);
        resolve(result);
      },
      () => {
        clearTimeout(timer);
        resolve(false);
      },
    );
  });
}

async function detectPlatforms(): Promise<string[]> {
  if (process.env[DISABLE_ENV]?.toLowerCase() === 'true') {
    return ['disabled'];
  }

  const detected: string[] = [];

  for (const { name, detector } of ENV_DETECTORS) {
    if (detector()) {
      detected.push(name);
    }
  }

  const asyncResults = await Promise.all(
    ASYNC_DETECTORS.map(async ({ name, detector }) => ({
      name,
      detected: await withTimeout(
        detector().catch(() => false),
        DETECTION_TIMEOUT_MS,
      ),
    })),
  );

  for (const { name, detected: isDetected } of asyncResults) {
    if (isDetected) {
      detected.push(name);
    }
  }

  return detected;
}

let platformPromise: Promise<string[]> | undefined;

export function initPlatformDetection() {
  if (!platformPromise) {
    platformPromise = detectPlatforms();
  }
}

export function getDetectedPlatforms(): Promise<string[]> {
  if (!platformPromise) {
    initPlatformDetection();
  }
  return platformPromise!;
}
