import assert from 'assert';
import sinon from 'sinon';
import fs from 'fs/promises';
import ASN1 from 'asn1.js-rfc5280';
import {
  CRL_MEMORY_CACHE,
  MEMORY_CACHE_DEFAULT_EXPIRATION_TIME,
  DISK_CACHE_REMOVE_DELAY,
  getCrlFromMemory,
  setCrlInMemory,
  getCrlCacheDir,
  getCrlFromDisk,
  writeCrlToDisk,
} from '../../../lib/agent/crl_cache';
import { createTestCRL } from './test_utils';

describe('CRL cache', () => {
  const fakeNow = new Date('2025-01-01T00:00:00Z').getTime();
  const crlUrl = 'http://example.com/file.crl';
  const testCrl = createTestCRL();
  const testCrlRaw = ASN1.CertificateList.encode(testCrl, 'der');

  beforeEach(() => {
    sinon.useFakeTimers(fakeNow);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('setCrlInMemory', () => {
    beforeEach(() => {
      CRL_MEMORY_CACHE.clear();
    });

    it('adds crl to cache with expiration time', () => {
      setCrlInMemory(crlUrl, testCrl);
      const cachedEntry = CRL_MEMORY_CACHE.get(crlUrl);
      assert.strictEqual(cachedEntry?.expireAt, testCrl.tbsCertList.nextUpdate!.value);
      assert.strictEqual(cachedEntry?.crl, testCrl);
    });

    it('adds crl to cache with default expiration time if nextUpdate is not set', () => {
      const crlWithoutNextUpdate = createTestCRL();
      crlWithoutNextUpdate.tbsCertList.nextUpdate = undefined;
      setCrlInMemory(crlUrl, crlWithoutNextUpdate);
      const cachedEntry = CRL_MEMORY_CACHE.get(crlUrl);
      assert.strictEqual(cachedEntry?.expireAt, fakeNow + MEMORY_CACHE_DEFAULT_EXPIRATION_TIME);
      assert.strictEqual(cachedEntry?.crl, crlWithoutNextUpdate);
    });
  });

  describe('getCrlFromMemory', () => {
    beforeEach(() => {
      CRL_MEMORY_CACHE.clear();
    });

    it('returns null when CRL is not in cache', () => {
      const result = getCrlFromMemory(crlUrl);
      assert.strictEqual(result, null);
    });

    it('returns null when crl is in cache and is expired + deletes expired entry', () => {
      CRL_MEMORY_CACHE.set(crlUrl, {
        expireAt: Date.now() - 1,
        crl: testCrl,
      });
      const result = getCrlFromMemory(crlUrl);
      assert.strictEqual(result, null);
      assert.strictEqual(CRL_MEMORY_CACHE.size, 0);
    });

    it('returns crl when crl is in cache and is not expired', () => {
      CRL_MEMORY_CACHE.set(crlUrl, {
        expireAt: Date.now() + 100_000,
        crl: testCrl,
      });
      const result = getCrlFromMemory(crlUrl);
      assert.strictEqual(result, testCrl);
    });
  });

  describe('writeCrlToDisk', () => {
    afterEach(async () => {
      await fs.rm(getCrlCacheDir(), { recursive: true, force: true });
    });

    [
      {
        expirationTime: undefined,
        expectedFileName: `${fakeNow + DISK_CACHE_REMOVE_DELAY}__${encodeURIComponent(crlUrl)}`,
      },
      {
        expirationTime: fakeNow + 1000,
        expectedFileName: `${fakeNow + 1000}__${encodeURIComponent(crlUrl)}`,
      },
    ].forEach(({ expirationTime, expectedFileName }) => {
      it(`writes crl to disk with ${expirationTime ? 'explicit' : 'default'} expiration time`, async () => {
        await writeCrlToDisk(crlUrl, testCrlRaw, expirationTime);
        const cacheDirFiles = await fs.readdir(getCrlCacheDir());
        assert.strictEqual(cacheDirFiles.length, 1);
        assert.strictEqual(cacheDirFiles[0], expectedFileName);
      });
    });
  });

  describe('getCrlFromDisk', () => {
    beforeEach(async () => {
      await fs.mkdir(getCrlCacheDir(), { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(getCrlCacheDir(), { recursive: true, force: true });
    });

    it('return null when cache dir doesnt exist', async () => {
      await fs.rm(getCrlCacheDir(), { recursive: true, force: true });
      const result = await getCrlFromDisk(crlUrl);
      assert.strictEqual(result, null);
    });

    it('returns null when no CRL is found', async () => {
      const result = await getCrlFromDisk(crlUrl);
      assert.strictEqual(result, null);
    });

    it('returns null when CRL is expired', async () => {
      await writeCrlToDisk(crlUrl, testCrlRaw, fakeNow - 1);
      const result = await getCrlFromDisk(crlUrl);
      assert.strictEqual(result, null);
    });

    it('clears expired CRLs from disk after delay', async () => {
      await writeCrlToDisk(crlUrl, testCrlRaw, fakeNow - DISK_CACHE_REMOVE_DELAY - 1);
      const result = await getCrlFromDisk(crlUrl);
      assert.strictEqual((await fs.readdir(getCrlCacheDir())).length, 0);
      assert.strictEqual(result, null);
    });

    it('returns parsed CRL when found valid on disk', async () => {
      await writeCrlToDisk(crlUrl, testCrlRaw);
      const result = await getCrlFromDisk(crlUrl);
      assert.deepEqual(result, testCrl);
    });
  });
});
