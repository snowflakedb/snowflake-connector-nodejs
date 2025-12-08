import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// NOTE:
// Musl detection is copy-pasted from napi-rs binding file generator
export function isMusl(): boolean {
  let musl = false;
  if (process.platform === 'linux') {
    let fsResult = isMuslFromFilesystem();
    if (fsResult === null) {
      fsResult = isMuslFromReport();
    }
    if (fsResult === null) {
      musl = isMuslFromChildProcess();
    } else {
      musl = fsResult;
    }
  }
  return musl;
}

function isFileMusl(filePath: string): boolean {
  return filePath.includes('libc.musl-') || filePath.includes('ld-musl-');
}

function isMuslFromFilesystem(): boolean | null {
  try {
    return readFileSync('/usr/bin/ldd', 'utf-8').includes('musl');
  } catch {
    return null;
  }
}

function isMuslFromReport(): boolean | null {
  let report: any = null;
  const processReport = (process as any).report;
  if (typeof processReport?.getReport === 'function') {
    // Avoid collecting network info while generating report
    processReport.excludeNetwork = true;
    report = processReport.getReport();
  }
  if (!report) {
    return null;
  }
  if (report.header && report.header.glibcVersionRuntime) {
    return false;
  }
  if (Array.isArray(report.sharedObjects)) {
    if (report.sharedObjects.some(isFileMusl)) {
      return true;
    }
  }
  return false;
}

function isMuslFromChildProcess(): boolean {
  try {
    return execSync('ldd --version', { encoding: 'utf8' }).includes('musl');
  } catch {
    // Unknown if the system is musl; default to false
    return false;
  }
}
