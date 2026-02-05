import assert from 'assert';
import { vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { getBinaryName, getMinicoreStatus } from '../../lib/minicore/minicore';

// Helper function to test getBinaryName on Linux (needs isMusl mock for CI compatibility)
async function testGetBinaryNameLinux(arch: string, isMusl: boolean, expectBinaryName: string) {
  vi.resetModules();
  vi.doMock('../../lib/minicore/is_musl', () => ({
    isMusl: () => isMusl,
  }));
  const originalPlatform = process.platform;
  const originalArch = process.arch;
  Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
  Object.defineProperty(process, 'arch', { value: arch, configurable: true });
  try {
    const { getBinaryName: getBinaryNameFresh } = await import('../../lib/minicore/minicore');
    const binaryName = getBinaryNameFresh();
    const expectBinaryPath = path.join(__dirname, '../../lib/minicore/binaries', expectBinaryName);
    assert.strictEqual(binaryName, expectBinaryName);
    assert.ok(fs.existsSync(expectBinaryPath), `Binary should exist at ${expectBinaryPath}`);
  } finally {
    Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    Object.defineProperty(process, 'arch', { value: originalArch, configurable: true });
  }
}

describe('getBinaryName()', () => {
  // Non-Linux platforms: isMusl() always returns false, no mock needed
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
      platform: 'win32',
      arch: 'arm64',
      expectBinaryName: 'sf_mini_core_0.0.1.win32-arm64-msvc.node',
    },
    {
      platform: 'win32',
      arch: 'ia32',
      expectBinaryName: 'sf_mini_core_0.0.1.win32-ia32-msvc.node',
    },
    {
      platform: 'win32',
      arch: 'x64',
      expectBinaryName: 'sf_mini_core_0.0.1.win32-x64-msvc.node',
    },
  ].forEach(({ platform, arch, expectBinaryName }) => {
    it(`returns ${expectBinaryName} for ${platform}-${arch}`, () => {
      vi.spyOn(process, 'platform', 'get').mockReturnValue(platform as NodeJS.Platform);
      vi.spyOn(process, 'arch', 'get').mockReturnValue(arch);
      const binaryName = getBinaryName();
      const expectBinaryPath = path.join(
        __dirname,
        '../../lib/minicore/binaries',
        expectBinaryName,
      );
      assert.strictEqual(binaryName, expectBinaryName);
      assert.ok(fs.existsSync(expectBinaryPath), `Binary should exist at ${expectBinaryPath}`);
    });
  });

  // Linux with gnu (isMusl = false) - needs mock for CI on Alpine/musl systems
  [
    { arch: 'arm64', expectBinaryName: 'sf_mini_core_0.0.1.linux-arm64-gnu.node' },
    { arch: 'x64', expectBinaryName: 'sf_mini_core_0.0.1.linux-x64-gnu.node' },
  ].forEach(({ arch, expectBinaryName }) => {
    it(`returns ${expectBinaryName} for linux-${arch} with gnu`, async () => {
      await testGetBinaryNameLinux(arch, false, expectBinaryName);
    });
  });

  // Linux with musl (isMusl = true) - needs mock for CI on glibc systems
  [
    { arch: 'arm64', expectBinaryName: 'sf_mini_core_0.0.1.linux-arm64-musl.node' },
    { arch: 'x64', expectBinaryName: 'sf_mini_core_0.0.1.linux-x64-musl.node' },
  ].forEach(({ arch, expectBinaryName }) => {
    it(`returns ${expectBinaryName} for linux-${arch} with musl`, async () => {
      await testGetBinaryNameLinux(arch, true, expectBinaryName);
    });
  });
});

describe('getMinicoreStatus()', () => {
  it('returns correct status metadata', () => {
    const minicoreStatus = getMinicoreStatus();
    assert.deepStrictEqual(minicoreStatus, {
      version: '0.0.1',
      binaryName: getBinaryName(),
      error: null,
    });
  });

  it('returns error when minicore loading is disabled via SNOWFLAKE_DISABLE_MINICORE env variable', async () => {
    vi.stubEnv('SNOWFLAKE_DISABLE_MINICORE', 'true');
    // Dynamically re-import the module to pick up the new env variable
    vi.resetModules();
    const minicoreModule = await import('../../lib/minicore/minicore');
    const minicoreStatus = minicoreModule.getMinicoreStatus();
    assert.deepStrictEqual(minicoreStatus, {
      version: null,
      binaryName: null,
      error: 'Minicore is disabled with SNOWFLAKE_DISABLE_MINICORE env variable',
    });
  });

  it('returns error when minicore fails to load', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue(
      'dummy-test-platform-to-force-load-error' as NodeJS.Platform,
    );
    vi.resetModules();
    const minicoreModule = await import('../../lib/minicore/minicore');
    const minicoreStatus = minicoreModule.getMinicoreStatus();
    assert.deepStrictEqual(minicoreStatus, {
      version: null,
      binaryName: minicoreModule.getBinaryName(),
      error: 'Failed to load binary',
    });
  });
});
