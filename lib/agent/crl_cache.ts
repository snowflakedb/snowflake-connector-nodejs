import path from 'path';
import fs from 'fs/promises';
import ASN1 from 'asn1.js-rfc5280';
import { getDefaultCacheDir, writeCacheFile } from '../disk_cache';
import Logger from '../logger';

export const MEMORY_CACHE_DEFAULT_EXPIRATION_TIME = 1000 * 60 * 60 * 24; // 24 hours
export const DISK_CACHE_REMOVE_DELAY = 1000 * 60 * 60 * 24 * 7; // 7 days
export const CRL_MEMORY_CACHE = new Map<
  string,
  { expireAt: number; crl: ASN1.CertificateListDecoded }
>();

export function getCrlFromMemory(url: string) {
  const cachedEntry = CRL_MEMORY_CACHE.get(url);
  if (cachedEntry) {
    if (cachedEntry.crl.tbsCertList.nextUpdate.value > Date.now()) {
      return cachedEntry.crl;
    } else {
      CRL_MEMORY_CACHE.delete(url);
      return null;
    }
  } else {
    return null;
  }
}

export function setCrlInMemory(url: string, crl: ASN1.CertificateListDecoded) {
  CRL_MEMORY_CACHE.set(url, {
    expireAt: Math.min(
      Date.now() + MEMORY_CACHE_DEFAULT_EXPIRATION_TIME,
      crl.tbsCertList.nextUpdate.value,
    ),
    crl,
  });
}

export function clearExpiredCrlFromMemoryCache() {
  CRL_MEMORY_CACHE.forEach((entry, key) => {
    if (entry.expireAt < Date.now()) {
      CRL_MEMORY_CACHE.delete(key);
    }
  });
}

export function getCrlCacheDir() {
  return path.join(getDefaultCacheDir(), 'crls');
}

export async function clearExpiredCrlFromDiskCache() {
  // NOTE:
  // Ideally we'd like to delete files where now > nextUpdate + CRL_DISK_CACHE_REMOVE_DELAY
  //
  // This is problematic due to:
  // - reading CRL nextUpdate is expensive IO blocking operation
  // - we can't store nextUpdate in file name to be consistent with other drivers
  //
  // So assuming that anything older than 30 days is expired and should be deleted.
  try {
    const cacheDir = getCrlCacheDir();
    for (const fileName of await fs.readdir(cacheDir)) {
      const filePath = path.join(cacheDir, fileName);
      const stats = await fs.stat(filePath);
      const thirtyDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 30;
      if (stats.mtime.getTime() < thirtyDaysAgo) {
        Logger().debug(`Deleting CRL file ${fileName} older than 30 days.`);
        await fs.rm(filePath);
      }
    }
  } catch (error: unknown) {
    Logger().warn(`Failed to clear expired entries from disk cache: ${error}.`);
  }
}

export async function getCrlFromDisk(url: string) {
  const filePath = path.join(getCrlCacheDir(), encodeURIComponent(url));

  try {
    const rawCrl = await fs.readFile(filePath);
    const decodedCrl = ASN1.CertificateList.decode(rawCrl, 'der');
    if (decodedCrl.tbsCertList.nextUpdate.value > Date.now()) {
      return decodedCrl;
    } else {
      Logger().debug(`CRL ${filePath} is expired, ignoring.`);
      return null;
    }
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      Logger().debug(`CRL ${url} not found on disk cache.`);
    } else {
      Logger().warn(`Failed to read CRL ${filePath} from disk cache: ${error}.`);
    }
  }

  return null;
}

export async function writeCrlToDisk(url: string, rawCrl: Buffer) {
  const filePath = path.join(getCrlCacheDir(), encodeURIComponent(url));
  try {
    return writeCacheFile(filePath, rawCrl);
  } catch (error: unknown) {
    Logger().warn(`Failed to write CRL ${filePath} to disk cache: ${error}.`);
  }
}
