// Similar to platform detection implementation on other drivers, but for now targeting only
// serverless platforms where we need to test minicore.
const PLATFORM_DETECTORS = [
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
];

function areAllEnvVarsPresent(...envVars: string[]) {
  return envVars.every((envVar) => {
    const value = process.env[envVar];
    return value !== undefined && value !== '';
  });
}

let detectedPlatforms: string[] | undefined;
export function getDetectedPlatforms() {
  if (detectedPlatforms) {
    return detectedPlatforms;
  }

  detectedPlatforms = [];
  for (const { name, detector } of PLATFORM_DETECTORS) {
    if (detector()) {
      detectedPlatforms.push(name);
    }
  }
  return detectedPlatforms;
}
