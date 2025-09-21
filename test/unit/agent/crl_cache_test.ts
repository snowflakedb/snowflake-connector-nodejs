import assert from 'assert';
import sinon from 'sinon';
import fs from 'fs/promises';
import path from 'path';
import ASN1 from 'asn1.js-rfc5280';
import {
  CRL_MEMORY_CACHE,
  getCrlFromMemory,
  setCrlInMemory,
  getCrlFromDisk,
  writeCrlToDisk,
  clearExpiredCrlFromMemoryCache,
  clearExpiredCrlFromDiskCache,
} from '../../../lib/agent/crl_cache';
import GlobalConfigTyped from '../../../lib/global_config_typed';
import { createTestCRL } from './test_utils';
import { writeCacheFile } from '../../../lib/disk_cache';

describe('CRL cache', () => {
  const fakeNow = new Date('2025-01-01T00:00:00Z').getTime();
  const crlCacheDir = GlobalConfigTyped.getValue('crlCacheDir');
  const crlCacheValidityTime = GlobalConfigTyped.getValue('crlCacheValidityTime');
  const crlUrl = 'http://example.com/file.crl';
  let testCrl: ASN1.CertificateListDecoded;
  let testCrlRaw: Buffer;

  beforeEach(async () => {
    sinon.useFakeTimers(fakeNow);
    testCrl = createTestCRL();
    testCrl.tbsCertList.nextUpdate.value = fakeNow + 1000;
    testCrlRaw = ASN1.CertificateList.encode(testCrl, 'der');
  });

  afterEach(async () => {
    await fs.rm(crlCacheDir, { recursive: true, force: true });
    CRL_MEMORY_CACHE.clear();
    sinon.restore();
  });

  describe('setCrlInMemory', () => {
    it('adds crl to cache with expiration time equal to crl nextUpdate when nextUpdate < 24 hours', () => {
      setCrlInMemory(crlUrl, testCrl);
      const cachedEntry = CRL_MEMORY_CACHE.get(crlUrl);
      assert.strictEqual(cachedEntry?.expireAt, testCrl.tbsCertList.nextUpdate.value);
      assert.strictEqual(cachedEntry?.crl, testCrl);
    });

    it('adds crl to cache with expiration time equal to default expiration when default is sooner', () => {
      testCrl.tbsCertList.nextUpdate.value = fakeNow + crlCacheValidityTime * 2;
      setCrlInMemory(crlUrl, testCrl);
      const cachedEntry = CRL_MEMORY_CACHE.get(crlUrl);
      assert.strictEqual(cachedEntry?.expireAt, fakeNow + crlCacheValidityTime);
      assert.strictEqual(cachedEntry?.crl, testCrl);
    });
  });

  describe('getCrlFromMemory', () => {
    it('returns null when CRL is not in cache', () => {
      const result = getCrlFromMemory(crlUrl);
      assert.strictEqual(result, null);
    });

    it('returns null when crl is in cache and is expired + deletes expired entry', () => {
      CRL_MEMORY_CACHE.set(crlUrl, {
        expireAt: fakeNow - 1000,
        crl: testCrl,
      });
      const result = getCrlFromMemory(crlUrl);
      assert.strictEqual(result, null);
      assert.strictEqual(CRL_MEMORY_CACHE.size, 0);
    });

    it('returns crl when crl is in cache and is not expired', () => {
      CRL_MEMORY_CACHE.set(crlUrl, {
        crl: testCrl,
        expireAt: fakeNow + 1000,
      });
      const result = getCrlFromMemory(crlUrl);
      assert.strictEqual(result, testCrl);
    });
  });

  describe('clearExpiredCrlFromMemoryCache', () => {
    it('removes expired entries from memory cache', () => {
      const expiredCrl = createTestCRL();
      const validCrl = createTestCRL();
      CRL_MEMORY_CACHE.set('http://expired.example.com/crl', {
        expireAt: fakeNow - 1000,
        crl: expiredCrl,
      });
      CRL_MEMORY_CACHE.set('https://valid.example.com/crl', {
        expireAt: fakeNow + 1000,
        crl: validCrl,
      });
      assert.strictEqual(CRL_MEMORY_CACHE.size, 2);
      clearExpiredCrlFromMemoryCache();
      assert.strictEqual(CRL_MEMORY_CACHE.size, 1);
      assert.strictEqual(CRL_MEMORY_CACHE.has('http://expired.example.com/crl'), false);
      assert.strictEqual(CRL_MEMORY_CACHE.has('https://valid.example.com/crl'), true);
    });
  });

  describe('writeCrlToDisk', () => {
    it('writes to disk with encoded url as file name', async () => {
      await writeCrlToDisk(crlUrl, testCrlRaw);
      const cacheDirFiles = await fs.readdir(crlCacheDir);
      assert.strictEqual(cacheDirFiles.length, 1);
      assert.strictEqual(cacheDirFiles[0], encodeURIComponent(crlUrl));
    });
  });

  describe('getCrlFromDisk', () => {
    it('returns null when no CRL is found', async () => {
      const result = await getCrlFromDisk(crlUrl);
      assert.strictEqual(result, null);
    });

    it('returns null when CRL is expired', async () => {
      testCrl.tbsCertList.nextUpdate.value = fakeNow - 1000;
      testCrlRaw = ASN1.CertificateList.encode(testCrl, 'der');
      await writeCrlToDisk(crlUrl, testCrlRaw);
      const result = await getCrlFromDisk(crlUrl);
      assert.strictEqual(result, null);
    });

    it('returns null CRL is on disk, but now > nextUpdate', async () => {
      testCrl.tbsCertList.nextUpdate.value = fakeNow - 1000;
      testCrlRaw = ASN1.CertificateList.encode(testCrl, 'der');
      await writeCrlToDisk(crlUrl, testCrlRaw);
      const result = await getCrlFromDisk(crlUrl);
      assert.strictEqual(result, null);
    });

    it('returns null when file mtime is older than GlobalConfig.crlCacheValidityTime', async () => {
      const crlWrittenAt = new Date(fakeNow - crlCacheValidityTime - 1000);
      const crlFilePath = path.join(crlCacheDir, encodeURIComponent(crlUrl));
      testCrl.tbsCertList.nextUpdate.value = fakeNow + 1000;
      testCrlRaw = ASN1.CertificateList.encode(testCrl, 'der');
      await writeCrlToDisk(crlUrl, testCrlRaw);
      await fs.utimes(crlFilePath, crlWrittenAt, crlWrittenAt);
      const result = await getCrlFromDisk(crlUrl);
      assert.strictEqual(result, null);
    });

    it('returns parsed CRL when found on disk with nextUpdate > now', async () => {
      testCrl.tbsCertList.nextUpdate.value = fakeNow + 1000;
      testCrlRaw = ASN1.CertificateList.encode(testCrl, 'der');
      await writeCrlToDisk(crlUrl, testCrlRaw);
      const result = await getCrlFromDisk(crlUrl);
      assert.deepEqual(result, testCrl);
    });
  });

  describe('clearExpiredCrlFromDiskCache', () => {
    it('removes files older than 30 days from disk cache', async () => {
      const crlCacheDir = GlobalConfigTyped.getValue('crlCacheDir');
      const oldFilePath = path.join(crlCacheDir, 'old_file.crl');
      const newFilePath = path.join(crlCacheDir, 'new_file.crl');
      const thirtyOneDaysAgo = fakeNow - 1000 * 60 * 60 * 24 * 31;

      await writeCacheFile(oldFilePath, testCrlRaw);
      await fs.utimes(oldFilePath, new Date(thirtyOneDaysAgo), new Date(thirtyOneDaysAgo));
      await writeCacheFile(newFilePath, testCrlRaw);
      const filesBefore = await fs.readdir(crlCacheDir);
      assert.strictEqual(filesBefore.length, 2);

      await clearExpiredCrlFromDiskCache();
      const filesAfter = await fs.readdir(crlCacheDir);
      assert.strictEqual(filesAfter.length, 1);
      assert.strictEqual(filesAfter[0], 'new_file.crl');
    });

    it('handles errors when accessing disk cache gracefully', async () => {
      sinon.stub(fs, 'readdir').rejects(new Error('ENOENT: no such file or directory'));
      await assert.doesNotReject(clearExpiredCrlFromDiskCache());
    });
  });
});
