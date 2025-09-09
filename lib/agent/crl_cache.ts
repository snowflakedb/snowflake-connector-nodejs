import path from 'path';
import fs from 'fs/promises';
import ASN1 from 'asn1.js-rfc5280';
import { getDefaultCacheDir, writeCacheFile } from '../disk_cache';
import Logger from '../logger';

export const MEMORY_CACHE_DEFAULT_EXPIRATION_TIME = 1000 * 60 * 60 * 24; // 24 hours
export const DISK_CACHE_REMOVE_DELAY = 1000 * 60 * 60 * 24 * 7; // 7 days
export const CRL_MEMORY_CACHE = new Map<
  string,
  {
    expireAt: number;
    crl: ASN1.CertificateListDecoded;
  }
>();

export function getCrlFromMemory(url: string) {
  const cachedEntry = CRL_MEMORY_CACHE.get(url);
  if (cachedEntry) {
    if (cachedEntry.expireAt > Date.now()) {
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
    expireAt:
      crl.tbsCertList.nextUpdate?.value ?? Date.now() + MEMORY_CACHE_DEFAULT_EXPIRATION_TIME,
    crl,
  });
}

export function getCrlCacheDir() {
  return path.join(getDefaultCacheDir(), 'crls');
}

// NOTE:
// Parsing CRLs is expensive, so we store expiration time in the file name
export async function getCrlFromDisk(url: string) {
  try {
    const cacheDir = getCrlCacheDir();
    const now = Date.now();

    for (const fileName of await fs.readdir(cacheDir)) {
      const match = fileName.match(/^(\d+)__(.+)$/);
      if (!match) continue;
      const expireAt = parseInt(match[1]);
      const crlFileName = match[2];

      if (now > expireAt) {
        if (now > expireAt + DISK_CACHE_REMOVE_DELAY) {
          await fs.rm(path.join(cacheDir, fileName));
        }
        continue;
      } else if (crlFileName === encodeURIComponent(url)) {
        const rawCrl = await fs.readFile(path.join(cacheDir, fileName));
        const decodedCrl = ASN1.CertificateList.decode(rawCrl, 'der');
        return decodedCrl;
      }
    }
  } catch (error: unknown) {
    Logger().warn(`Failed to read CRL ${url} from disk cache: ${error}.`);
  }

  return null;
}

export async function writeCrlToDisk(
  url: string,
  rawCrl: Buffer,
  expireAt = Date.now() + DISK_CACHE_REMOVE_DELAY,
) {
  const filePath = path.join(getCrlCacheDir(), `${expireAt}__${encodeURIComponent(url)}`);
  try {
    return writeCacheFile(filePath, rawCrl);
  } catch (error: unknown) {
    Logger().warn(`Failed to write CRL ${url} to disk cache: ${error}.`);
  }
}
