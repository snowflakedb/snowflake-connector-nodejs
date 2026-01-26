import { extractLinuxOsRelease } from './linux_os_release';
import Logger from '../../logger';

let cachedOsDetails: Record<string, string> | null = null;
let logDebugError: unknown | null = null;

try {
  if (process.platform === 'linux') {
    cachedOsDetails = extractLinuxOsRelease();
  }
} catch (error) {
  // Logger is not initialized at this point, so we store the error and log it on the first
  // getOsDetails() call
  logDebugError = error;
  cachedOsDetails = null;
}

export function getOsDetails() {
  if (logDebugError) {
    Logger().debug('Error extracting OS details: %s', logDebugError);
    logDebugError = null;
  }
  return cachedOsDetails;
}
