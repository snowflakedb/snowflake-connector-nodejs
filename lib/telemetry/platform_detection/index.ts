import { DETECTORS } from './detectors';

export const DETECTION_TIMEOUT_MS = 200;

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

const platformPromise = detectPlatforms();

export function getDetectedPlatforms(): Promise<string[]> {
  return platformPromise;
}
