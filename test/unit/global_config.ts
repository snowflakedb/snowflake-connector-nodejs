import assert from 'assert';
import sinon from 'sinon';
import GlobalConfigTyped, {
  GLOBAL_CONFIG_DEFAULTS,
  globalConfigSetOptions,
} from '../../lib/global_config_typed';

describe('GlobalConfig', () => {
  beforeEach(() => {
    for (const key in globalConfigSetOptions) {
      delete globalConfigSetOptions[key as keyof typeof globalConfigSetOptions];
    }
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('default values', () => {
    it('crlCacheDir reads from env variable when available', () => {
      sinon.stub(process, 'env').value({ SNOWFLAKE_CRL_ON_DISK_CACHE_DIR: 'test' });
      assert.strictEqual(GLOBAL_CONFIG_DEFAULTS.crlCacheDir(), 'test');
    });

    it('crlCacheDir builds correct cache path when no env variable set', () => {
      sinon.stub(process, 'env').value({ SNOWFLAKE_CRL_ON_DISK_CACHE_DIR: '' });
      assert(GLOBAL_CONFIG_DEFAULTS.crlCacheDir().includes('crls'));
    });
  });

  it('getValue returns default value if not configured', () => {
    assert.strictEqual(
      GlobalConfigTyped.getValue('crlDownloadTimeout'),
      GLOBAL_CONFIG_DEFAULTS.crlDownloadTimeout,
    );
  });

  it('getValue returns configured value', () => {
    GlobalConfigTyped.setValues({ crlCacheDir: 'test' });
    assert.strictEqual(GlobalConfigTyped.getValue('crlCacheDir'), 'test');
  });

  it('setValues sets only valid options and skipps undefined options', () => {
    GlobalConfigTyped.setValues({
      crlDownloadTimeout: 3000,
      crlCacheDir: undefined,
      // @ts-expect-error invalid key
      invalidKey: 'invalidValue',
    });
    assert.strictEqual(GlobalConfigTyped.getValue('crlDownloadTimeout'), 3000);
    assert.strictEqual(
      GlobalConfigTyped.getValue('crlCacheDir'),
      GLOBAL_CONFIG_DEFAULTS.crlCacheDir(),
    );
    // @ts-expect-error invalid key
    assert.strictEqual(GlobalConfigTyped.getValue('invalidKey'), undefined);
  });
});
