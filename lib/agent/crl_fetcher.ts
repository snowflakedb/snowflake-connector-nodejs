import ASN1 from 'asn1.js-rfc5280';
import axios from 'axios';
import Logger from '../logger';
import GlobalConfigTyped from '../global_config_typed';
import {
  clearExpiredCrlFromDiskCache,
  clearExpiredCrlFromMemoryCache,
  getCrlFromDisk,
  getCrlFromMemory,
  setCrlInMemory,
  writeCrlToDisk,
} from './crl_cache';

export const PENDING_FETCH_REQUESTS = new Map<string, Promise<ASN1.CertificateListDecoded>>();
let crlCacheCleanerCreated = false;

export async function getCrl(
  url: string,
  options: {
    inMemoryCache: boolean;
    onDiskCache: boolean;
  },
) {
  const logDebug = (msg: string) => Logger().debug(`getCrl[${url}]: ${msg}`);

  if (!crlCacheCleanerCreated) {
    crlCacheCleanerCreated = true;
    const oneHour = 1000 * 60 * 60;

    if (options.inMemoryCache) {
      logDebug('Starting memory cache cleaner');
      clearExpiredCrlFromMemoryCache();
      setInterval(clearExpiredCrlFromMemoryCache, oneHour).unref();
    }
    if (options.onDiskCache) {
      logDebug('Starting disk cache cleaner');
      clearExpiredCrlFromDiskCache();
      setInterval(clearExpiredCrlFromDiskCache, oneHour).unref();
    }
  }

  const pendingFetchRequest = PENDING_FETCH_REQUESTS.get(url);
  if (pendingFetchRequest) {
    logDebug(`Returning pending fetch request`);
    return pendingFetchRequest;
  }

  if (options.inMemoryCache) {
    const cachedCrl = getCrlFromMemory(url);
    if (cachedCrl) {
      logDebug(`Returning CRL from in-memory cache`);
      return cachedCrl;
    }
  }

  if (options.onDiskCache) {
    const cachedCrl = await getCrlFromDisk(url);
    if (cachedCrl) {
      if (options.inMemoryCache) {
        setCrlInMemory(url, cachedCrl);
      }
      logDebug(`Returning CRL from disk cache`);
      return cachedCrl;
    }
  }

  const fetchPromise = new Promise<ASN1.CertificateListDecoded>(async (resolve, reject) => {
    try {
      logDebug(`Downloading CRL`);
      const { data } = await axios.get(url, {
        timeout: GlobalConfigTyped.getValue('crlDownloadTimeout'),
        responseType: 'arraybuffer',
      });

      logDebug(`Parsing CRL`);
      const parsedCrl = ASN1.CertificateList.decode(data, 'der');

      if (options.inMemoryCache) {
        logDebug('Saving to memory cache');
        setCrlInMemory(url, parsedCrl);
      }

      if (options.onDiskCache) {
        logDebug('Saving to disk cache');
        await writeCrlToDisk(url, data);
      }

      PENDING_FETCH_REQUESTS.delete(url);
      return resolve(parsedCrl);
    } catch (error: unknown) {
      reject(error);
    }
  });

  PENDING_FETCH_REQUESTS.set(url, fetchPromise);

  return fetchPromise;
}
