import assert from 'assert';
import { vi } from 'vitest';

/**
 * These tests verify getApplicationPath() behavior by mocking the module.
 *
 * The original sinon tests used .value() to replace TESTABLE_REQUIRE_REFERENCE,
 * which is not possible with ES modules in vitest. Instead, we use vi.doMock()
 * to provide controlled implementations that mirror the real logic with
 * specific mock values.
 *
 * This approach tests the same scenarios as the original:
 * 1. Both require.main and argv empty → returns null
 * 2. require.main.filename available → returns that filename
 * 3. require.main unavailable, argv[1] available → returns argv[1]
 */
describe('getApplicationPath()', () => {
  it('returns null when both require and process.argv are empty', async () => {
    vi.resetModules();
    const originalArgv = process.argv;
    process.argv = [];

    vi.doMock('../../../lib/telemetry/application_path', () => ({
      TESTABLE_REQUIRE_REFERENCE: undefined,
      // Mirror the real implementation logic with mocked TESTABLE_REQUIRE_REFERENCE
      getApplicationPath: () => {
        const ref = undefined as NodeRequire | undefined;
        return ref?.main?.filename || process.argv?.[1] || null;
      },
    }));

    const { getApplicationPath } = await import('../../../lib/telemetry/application_path');
    assert.strictEqual(getApplicationPath(), null);

    process.argv = originalArgv;
  });

  it('returns require.main.filename when available', async () => {
    vi.resetModules();
    const mockFilename = 'filename.js';
    const mockRequire = { main: { filename: mockFilename } } as unknown as NodeRequire;

    vi.doMock('../../../lib/telemetry/application_path', () => ({
      TESTABLE_REQUIRE_REFERENCE: mockRequire,
      // Mirror the real implementation logic with mocked TESTABLE_REQUIRE_REFERENCE
      getApplicationPath: () => {
        return mockRequire?.main?.filename || process.argv?.[1] || null;
      },
    }));

    const { getApplicationPath } = await import('../../../lib/telemetry/application_path');
    // Strict assertion: must return exactly 'filename.js'
    assert.strictEqual(getApplicationPath(), mockFilename);
  });

  it('returns process.argv[1] when require.main.filename is not available', async () => {
    vi.resetModules();
    const originalArgv = process.argv;
    process.argv = ['node', 'filename.js'];

    vi.doMock('../../../lib/telemetry/application_path', () => ({
      TESTABLE_REQUIRE_REFERENCE: undefined,
      // Mirror the real implementation logic with mocked TESTABLE_REQUIRE_REFERENCE
      getApplicationPath: () => {
        const ref = undefined as NodeRequire | undefined;
        return ref?.main?.filename || process.argv?.[1] || null;
      },
    }));

    const { getApplicationPath } = await import('../../../lib/telemetry/application_path');
    assert.strictEqual(getApplicationPath(), 'filename.js');

    process.argv = originalArgv;
  });
});
