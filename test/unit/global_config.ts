import assert from 'assert';
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

  it('getValue returns default value if not configured', () => {
    assert.strictEqual(
      GlobalConfigTyped.getValue('crlInMemoryCache'),
      GLOBAL_CONFIG_DEFAULTS.crlInMemoryCache,
    );
  });

  it('getValue returns configured value', () => {
    GlobalConfigTyped.setOptions({ crlResponseCacheDir: 'test' });
    assert.strictEqual(GlobalConfigTyped.getValue('crlResponseCacheDir'), 'test');
  });

  it('setGlobalConfigTypedOptions sets only valid options and skipps undefined options', () => {
    GlobalConfigTyped.setOptions({
      crlInMemoryCache: false,
      crlDownloadTimeout: undefined,
      // @ts-expect-error invalid key
      invalidKey: 'invalidValue',
    });
    assert.strictEqual(GlobalConfigTyped.getValue('crlInMemoryCache'), false);
    assert.strictEqual(
      GlobalConfigTyped.getValue('crlDownloadTimeout'),
      GLOBAL_CONFIG_DEFAULTS.crlDownloadTimeout,
    );
    // @ts-expect-error invalid key
    assert.strictEqual(GlobalConfigTyped.getValue('invalidKey'), undefined);
  });
});
