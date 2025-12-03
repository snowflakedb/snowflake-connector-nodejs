import { proxy, proxyRequire } from 'proxyrequire';
import assert from 'assert';
import sinon from 'sinon';
import fs from 'fs';
import path from 'path';
import { getBinaryName, getMinicoreStatus } from '../../lib/minicore/minicore';

describe('getBinaryName()', () => {
  afterEach(() => sinon.restore());

  [
    {
      platform: 'darwin',
      arch: 'arm64',
      expectBinaryName: 'sf_mini_core_0.0.1.darwin-arm64.node',
    },
    {
      platform: 'darwin',
      arch: 'x64',
      expectBinaryName: 'sf_mini_core_0.0.1.darwin-x64.node',
    },
    {
      platform: 'linux',
      arch: 'arm64',
      expectBinaryName: 'sf_mini_core_0.0.1.linux-arm64-gnu.node',
    },
    {
      platform: 'linux',
      arch: 'x64',
      expectBinaryName: 'sf_mini_core_0.0.1.linux-x64-gnu.node',
    },
    {
      platform: 'linux',
      arch: 'arm64',
      withMusl: true,
      expectBinaryName: 'sf_mini_core_0.0.1.linux-arm64-musl.node',
    },
    {
      platform: 'linux',
      arch: 'x64',
      withMusl: true,
      expectBinaryName: 'sf_mini_core_0.0.1.linux-x64-musl.node',
    },
    {
      platform: 'win32',
      arch: 'arm64',
      expectBinaryName: 'sf_mini_core_0.0.1.win32-arm64-msvc.node',
    },
    {
      platform: 'win32',
      arch: 'x64',
      expectBinaryName: 'sf_mini_core_0.0.1.win32-x64-msvc.node',
    },
  ].forEach(({ platform, arch, withMusl, expectBinaryName }) => {
    it(`returns ${expectBinaryName} for ${platform}-${arch}${withMusl ? ' with musl' : ''}`, () => {
      sinon.stub(process, 'platform').value(platform);
      sinon.stub(process, 'arch').value(arch);
      if (withMusl) {
        sinon.stub(fs, 'readFileSync').withArgs('/usr/bin/ldd', 'utf-8').returns('musl libc');
      }
      const binaryName = getBinaryName();
      const expectBinaryPath = path.join(__dirname, '../../lib/minicore/dist', expectBinaryName);
      assert.strictEqual(binaryName, expectBinaryName);
      assert.ok(fs.existsSync(expectBinaryPath), `Binary should exist at ${expectBinaryPath}`);
    });
  });
});

describe('getMinicoreStatus()', () => {
  afterEach(() => sinon.restore());

  function getFreshMinicoreModule() {
    return proxy(() => {
      return proxyRequire(require, '../../lib/minicore/minicore');
    }, {}) as typeof import('../../lib/minicore/minicore');
  }

  it('returns correct status metadata', () => {
    const minicoreStatus = getMinicoreStatus();
    assert.deepStrictEqual(minicoreStatus, {
      version: '0.0.1',
      binaryName: getBinaryName(),
      error: null,
    });
  });

  it('returns false when minicore loading is disabled via SNOWFLAKE_DISABLE_MINICORE env variable', () => {
    sinon.stub(process, 'env').value({ SNOWFLAKE_DISABLE_MINICORE: 'true' });
    const minicoreModule = getFreshMinicoreModule();
    const minicoreStatus = minicoreModule.getMinicoreStatus();
    assert.deepStrictEqual(minicoreStatus, {
      version: null,
      binaryName: null,
      error: 'Minicore is disabled with SNOWFLAKE_DISABLE_MINICORE env variable',
    });
  });

  it('returns false when minicore fails to load', () => {
    sinon.stub(process, 'platform').value('dummy-test-platform-to-force-load-error');
    const minicoreModule = getFreshMinicoreModule();
    const minicoreStatus = minicoreModule.getMinicoreStatus();
    assert.deepStrictEqual(minicoreStatus, {
      version: null,
      binaryName: null,
      error: 'Failed to load binary',
    });
  });
});
