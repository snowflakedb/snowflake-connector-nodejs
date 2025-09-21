import assert from 'assert';
import sinon from 'sinon';
import fs from 'fs/promises';
import axios from 'axios';
import ASN1 from 'asn1.js-rfc5280';
import * as crlCacheModule from '../../../lib/agent/crl_cache';
import { getCrl, PENDING_FETCH_REQUESTS } from '../../../lib/agent/crl_fetcher';
import GlobalConfigTyped from '../../../lib/global_config_typed';
import { createTestCRL } from './test_utils';

describe('getCrl', () => {
  const crlUrl = 'http://example.com/crl.crl';
  const crlCacheDir = GlobalConfigTyped.getValue('crlCacheDir');
  const testCrl = createTestCRL();
  const testCrlRaw = Buffer.from(ASN1.CertificateList.encode(testCrl, 'der'));
  let axiosGetStub: sinon.SinonStub;

  beforeEach(() => {
    axiosGetStub = sinon.stub(axios, 'get');
  });

  afterEach(async () => {
    crlCacheModule.CRL_MEMORY_CACHE.clear();
    await fs.rm(crlCacheDir, { recursive: true, force: true });
    sinon.restore();
  });

  it('starts periodic cache cleaners on first call when caches are enabled', async () => {
    axiosGetStub.resolves({ data: testCrlRaw });
    const setIntervalSpy = sinon.spy(global, 'setInterval');
    const clearExpiredCrlFromMemoryCacheSpy = sinon.spy(
      crlCacheModule,
      'clearExpiredCrlFromMemoryCache',
    );
    const clearExpiredCrlFromDiskCacheSpy = sinon.spy(
      crlCacheModule,
      'clearExpiredCrlFromDiskCache',
    );
    await getCrl(crlUrl, {
      inMemoryCache: true,
      onDiskCache: true,
    });
    await getCrl(crlUrl, {
      inMemoryCache: true,
      onDiskCache: true,
    });
    assert.strictEqual(setIntervalSpy.callCount, 2);
    assert(setIntervalSpy.calledWith(clearExpiredCrlFromMemoryCacheSpy, 1000 * 60 * 60));
    assert(setIntervalSpy.calledWith(clearExpiredCrlFromDiskCacheSpy, 1000 * 60 * 60));
    assert.strictEqual(clearExpiredCrlFromDiskCacheSpy.callCount, 1);
  });

  it('returns CRL from fetched URL', async () => {
    axiosGetStub.resolves({ data: testCrlRaw });
    const fetchedCrl = await getCrl(crlUrl, {
      inMemoryCache: false,
      onDiskCache: false,
    });
    assert(
      axiosGetStub.calledOnceWith(crlUrl, {
        timeout: GlobalConfigTyped.getValue('crlDownloadTimeout'),
        responseType: 'arraybuffer',
      }),
    );
    assert.deepEqual(fetchedCrl, testCrl);
  });

  it('fetches only once if multiple requests are made at the same time', async () => {
    axiosGetStub.resolves({ data: testCrlRaw });
    const [crl1, crl2] = await Promise.all([
      getCrl(crlUrl, {
        inMemoryCache: false,
        onDiskCache: false,
      }),
      getCrl(crlUrl, {
        inMemoryCache: false,
        onDiskCache: false,
      }),
    ]);
    assert.strictEqual(axiosGetStub.callCount, 1);
    assert.strictEqual(PENDING_FETCH_REQUESTS.size, 0);
    assert.deepEqual(crl1, testCrl);
    assert.deepEqual(crl2, testCrl);
  });

  it('writes fetched data to cache', async () => {
    axiosGetStub.resolves({ data: testCrlRaw });
    await getCrl(crlUrl, {
      inMemoryCache: true,
      onDiskCache: true,
    });
    assert.strictEqual(axiosGetStub.callCount, 1);
    assert.deepEqual(crlCacheModule.getCrlFromMemory(crlUrl), testCrl);
    assert.deepEqual(await crlCacheModule.getCrlFromDisk(crlUrl), testCrl);
  });

  it('returns from memory cache if entry exists', async () => {
    crlCacheModule.setCrlInMemory(crlUrl, testCrl);
    const fetchedCrl = await getCrl(crlUrl, {
      inMemoryCache: true,
      onDiskCache: false,
    });
    assert.strictEqual(axiosGetStub.callCount, 0);
    assert.deepEqual(fetchedCrl, testCrl);
  });

  it('returns from disk cache and adds to memory cache if entry exists', async () => {
    await crlCacheModule.writeCrlToDisk(crlUrl, testCrlRaw);
    const fetchedCrl = await getCrl(crlUrl, {
      inMemoryCache: true,
      onDiskCache: true,
    });
    assert.strictEqual(axiosGetStub.callCount, 0);
    assert.deepEqual(fetchedCrl, testCrl);
    assert.deepEqual(crlCacheModule.getCrlFromMemory(crlUrl), testCrl);
  });
});
