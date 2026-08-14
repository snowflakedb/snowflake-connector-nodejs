import rfc5280 from 'asn1.js-rfc5280';
import axios from 'axios';
import Logger from '../../logger';
import GlobalConfigTyped from '../../global_config_typed';
import {
  clearExpiredCrlFromDiskCache,
  clearExpiredCrlFromMemoryCache,
  getCrlFromDisk,
  getCrlFromMemory,
  setCrlInMemory,
  writeCrlToDisk,
} from './crl_cache';
import { getRawTbsCertList, isCrlSignatureValid } from './crl_signature_verifier';

export const PENDING_FETCH_REQUESTS = new Map<string, Promise<rfc5280.CertificateListDecoded>>();

let memoryCacheCleanerInterval: NodeJS.Timeout | undefined;
let diskCacheCleanerInterval: NodeJS.Timeout | undefined;
let crlCacheCleanerCreated = false;

export function resetCrlCacheCleaner() {
  clearInterval(memoryCacheCleanerInterval);
  clearInterval(diskCacheCleanerInterval);
  crlCacheCleanerCreated = false;
}

export async function getCrl(
  url: string,
  options: {
    inMemoryCache: boolean;
    onDiskCache: boolean;
    // POC: issuer public key used to validate the CRL signature before it is
    // committed to any cache.
    issuerPublicKey: string;
  },
) {
  const logDebug = (msg: string) => Logger().debug(`getCrl[${url}]: ${msg}`);

  const assertSignatureValid = (crl: rfc5280.CertificateListDecoded, rawCrl: Buffer) => {
    const rawTbsCertList = getRawTbsCertList(rawCrl);
    if (!isCrlSignatureValid(crl, rawTbsCertList, options.issuerPublicKey)) {
      throw new Error(`CRL ${url} signature is invalid`);
    }
  };

  if (!crlCacheCleanerCreated) {
    crlCacheCleanerCreated = true;
    const oneHour = 1000 * 60 * 60;

    logDebug('Starting periodic memory cache cleaner');
    memoryCacheCleanerInterval = setInterval(clearExpiredCrlFromMemoryCache, oneHour).unref();

    logDebug('Starting periodic disk cache cleaner');
    clearExpiredCrlFromDiskCache();
    diskCacheCleanerInterval = setInterval(clearExpiredCrlFromDiskCache, oneHour).unref();
  }

  const pendingFetchRequest = PENDING_FETCH_REQUESTS.get(url);
  if (pendingFetchRequest) {
    logDebug(`Returning pending fetch request`);
    return pendingFetchRequest;
  }

  if (options.inMemoryCache) {
    logDebug(`Checking in-memory cache`);
    const cachedCrl = getCrlFromMemory(url);
    if (cachedCrl) {
      logDebug(`Returning from in-memory cache`);
      return cachedCrl;
    }
  }

  if (options.onDiskCache) {
    logDebug(`Checking on-disk cache`);
    const diskEntry = await getCrlFromDisk(url);
    if (diskEntry) {
      const { crl: cachedCrl, rawCrl } = diskEntry;
      // POC: validate signature before promoting a disk-cached CRL into memory.
      logDebug(`Validating signature of disk-cached CRL`);
      assertSignatureValid(cachedCrl, rawCrl);

      // POC: a disk read should populate the memory cache when it is not already present.
      if (options.inMemoryCache && !getCrlFromMemory(url)) {
        logDebug(`Populating memory cache from disk`);
        setCrlInMemory(url, cachedCrl);
      }
      logDebug(`Returning from disk cache`);
      return cachedCrl;
    }
  }

  const fetchPromise = (async () => {
    try {
      logDebug(`Downloading CRL`);
      const { data } = await axios.get(url, {
        timeout: GlobalConfigTyped.getValue('crlDownloadTimeout'),
        responseType: 'arraybuffer',
        maxContentLength: GlobalConfigTyped.getValue('crlDownloadMaxSize'),
      });

      logDebug(`Parsing CRL`);
      const parsedCrl = rfc5280.CertificateList.decode(data, 'der');

      // POC: validate signature before committing the CRL to any cache.
      logDebug(`Validating signature of downloaded CRL`);
      assertSignatureValid(parsedCrl, data);

      if (options.inMemoryCache) {
        logDebug('Saving to memory cache');
        setCrlInMemory(url, parsedCrl);
      }

      if (options.onDiskCache) {
        logDebug('Saving to disk cache');
        await writeCrlToDisk(url, data);
      }

      return parsedCrl;
    } finally {
      PENDING_FETCH_REQUESTS.delete(url);
    }
  })();

  PENDING_FETCH_REQUESTS.set(url, fetchPromise);

  return fetchPromise;
}
