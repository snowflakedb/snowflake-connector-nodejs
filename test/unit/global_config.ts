import assert from 'assert';
import GlobalConfigTyped, {
  GLOBAL_CONFIG_DEFAULTS,
  setGlobalConfigTypedOptions,
} from '../../lib/global_config_typed';

describe('GlobalConfig', () => {
  afterEach(() => {
    setGlobalConfigTypedOptions(GLOBAL_CONFIG_DEFAULTS);
  });

  it('returns GlobalConfig with default values', () => {
    assert.deepStrictEqual(GlobalConfigTyped, GLOBAL_CONFIG_DEFAULTS);
  });

  it('setGlobalConfigTypedOptions sets only valid options and skipps undefined options', () => {
    setGlobalConfigTypedOptions({
      crlInMemoryCache: false,
      crlDownloadTimeout: undefined,
      // @ts-expect-error invalid key
      invalidKey: 'invalidValue',
    });
    assert.deepStrictEqual(GlobalConfigTyped, {
      ...GLOBAL_CONFIG_DEFAULTS,
      crlInMemoryCache: false,
    });
  });
});
