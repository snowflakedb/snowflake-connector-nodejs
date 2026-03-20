import assert from 'assert';
import sinon from 'sinon';
import { getDefaultCacheDir } from '../../../lib/disk_cache';
import { getOcspCacheDir } from '../../../lib/agent/ocsp_response_cache';

describe('OCSP cache directory resolution', () => {
  afterEach(() => sinon.restore());

  it('uses SF_OCSP_RESPONSE_CACHE_DIR directly when set', () => {
    sinon.stub(process, 'env').value({
      ...process.env,
      SF_OCSP_RESPONSE_CACHE_DIR: '/custom/ocsp/cache',
    });
    assert.strictEqual(getOcspCacheDir(), '/custom/ocsp/cache');
  });

  it('falls back to platform default when env var is not set', () => {
    assert.strictEqual(getOcspCacheDir(), getDefaultCacheDir());
  });
});
