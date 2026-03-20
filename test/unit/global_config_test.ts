import assert from 'assert';
import sinon from 'sinon';
import GlobalConfigTyped, {
  GLOBAL_CONFIG_DEFAULTS,
  globalConfigCustomValues,
} from '../../lib/global_config_typed';

describe('GlobalConfig', () => {
  beforeEach(() => {
    for (const key in globalConfigCustomValues) {
      delete globalConfigCustomValues[key as keyof typeof globalConfigCustomValues];
    }
  });

  afterEach(() => {
    sinon.restore();
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

  it(`getValue('crlCacheDir') reads from env variable when available`, () => {
    sinon.stub(process, 'env').value({ SNOWFLAKE_CRL_ON_DISK_CACHE_DIR: 'dir_from_env' });
    assert.strictEqual(GlobalConfigTyped.getValue('crlCacheDir'), 'dir_from_env');
  });

  it(`getValue('crlCacheDir') builds default cache path when no env variable set`, () => {
    sinon.stub(process, 'env').value({ SNOWFLAKE_CRL_ON_DISK_CACHE_DIR: '' });
    assert(GlobalConfigTyped.getValue('crlCacheDir').includes('crls'));
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
      GLOBAL_CONFIG_DEFAULTS.crlCacheDir,
    );
    // @ts-expect-error invalid key
    assert.strictEqual(GlobalConfigTyped.getValue('invalidKey'), undefined);
  });
});
