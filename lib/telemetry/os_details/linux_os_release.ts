import { readFileSync } from 'fs';

const ALLOWED_KEYS = [
  'NAME',
  'PRETTY_NAME',
  'ID',
  'BUILD_ID',
  'IMAGE_ID',
  'IMAGE_VERSION',
  'VERSION',
  'VERSION_ID',
];

// Regex parses: KEY=value or KEY="value"
const OS_RELEASE_KEY_VALUE_REGEX = /^([A-Z0-9_]+)=(?:"([^"]*)"|(.*))$/;

export function extractLinuxOsRelease() {
  const contents = readFileSync('/etc/os-release', 'utf8');
  const result: Record<string, string> = {};
  for (const line of contents.split('\n')) {
    const match = line.match(OS_RELEASE_KEY_VALUE_REGEX);
    if (match) {
      const [, key, quotedValue, unquotedValue] = match;
      if (ALLOWED_KEYS.includes(key)) {
        result[key] = quotedValue ?? unquotedValue;
      }
    }
  }
  return result;
}
