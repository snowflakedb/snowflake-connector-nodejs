import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const GLIBC = 'glibc';
const MUSL = 'musl';
const LDD_PATH = '/usr/bin/ldd';
const RE_GLIBC_VERSION = /LIBC[-a-z0-9 ).]*?(\d+\.\d+)/i;
const RE_MUSL_VERSION = /Version\s+(\d+\.\d+[\d.]*)/i;

export type LibcFamily = typeof GLIBC | typeof MUSL;
export type LibcDetails = { family: LibcFamily | null; version: string | null };

let cachedResult: LibcDetails | undefined;

/*
 * Detection uses three strategies in order of increasing cost:
 * 1. Filesystem: read /usr/bin/ldd content — a simple file read, cheapest option
 * 2. Process report: process.report.getReport() — no filesystem access but heavier than a file read
 * 3. Child process: exec `getconf` and `ldd --version` — last resort, spawns a shell process
 *
 * Inspired by detect-libc (https://github.com/lovell/detect-libc)
 */
export function getLibcDetails(): LibcDetails {
  if (cachedResult !== undefined) {
    return cachedResult;
  }

  if (process.platform !== 'linux') {
    cachedResult = { family: null, version: null };
    return cachedResult;
  }

  const result: LibcDetails = { family: null, version: null };
  for (const detectFn of [detectFromFilesystem, detectFromReport, detectFromCommand]) {
    if (result.family && result.version) {
      break;
    }
    const detected = detectFn();
    if (detected?.family && !result.family) {
      result.family = detected.family;
    }
    if (detected?.version && !result.version) {
      result.version = detected.version;
    }
  }

  cachedResult = result;
  return cachedResult;
}

function detectFromFilesystem(): LibcDetails | null {
  try {
    const content = readFileSync(LDD_PATH, 'utf-8');
    let family: LibcFamily | null = null;
    if (content.includes('musl')) {
      family = MUSL;
    } else if (content.includes('GNU C Library')) {
      family = GLIBC;
    }
    if (!family) {
      return null;
    }
    const versionRe = family === GLIBC ? RE_GLIBC_VERSION : RE_MUSL_VERSION;
    const versionMatch = content.match(versionRe);
    return { family, version: versionMatch?.[1] ?? null };
  } catch {
    return null;
  }
}

function detectFromReport(): LibcDetails | null {
  const processReport = (process as any).report;
  if (typeof processReport?.getReport !== 'function') {
    return null;
  }
  const origExcludeNetwork = processReport.excludeNetwork;
  let report;
  try {
    processReport.excludeNetwork = true;
    report = processReport.getReport();
  } finally {
    processReport.excludeNetwork = origExcludeNetwork;
  }

  if (!report) {
    return null;
  }
  if (report.header?.glibcVersionRuntime) {
    return { family: GLIBC, version: report.header.glibcVersionRuntime };
  }
  if (Array.isArray(report.sharedObjects)) {
    const isMusl = report.sharedObjects.some(
      (f: string) => f.includes('libc.musl-') || f.includes('ld-musl-'),
    );
    if (isMusl) {
      return { family: MUSL, version: null };
    }
  }
  return null;
}

function detectFromCommand(): LibcDetails | null {
  try {
    const out = execSync('getconf GNU_LIBC_VERSION 2>&1 || true; ldd --version 2>&1 || true', {
      encoding: 'utf8',
    });
    const [getconfLine, lddLine1, lddLine2] = out.split(/[\r\n]+/);
    if (getconfLine?.includes('glibc')) {
      const version = getconfLine.trim().split(/\s+/)[1] ?? null;
      return { family: GLIBC, version };
    }
    if (lddLine1?.includes('musl')) {
      const version = lddLine2?.trim().split(/\s+/)[1] ?? null;
      return { family: MUSL, version };
    }
    return null;
  } catch {
    return null;
  }
}
