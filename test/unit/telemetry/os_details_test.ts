import assert from 'assert';
import { vi } from 'vitest';

const MOCK_OS_RELEASE = `
NAME="Arch Linux"
PRETTY_NAME="Arch Linux"
ID=arch
BUILD_ID=rolling
VERSION_ID=20251019.0.436919
ANSI_COLOR="38;2;23;147;209"
HOME_URL="https://archlinux.org/"
DOCUMENTATION_URL="https://wiki.archlinux.org/"
SUPPORT_URL="https://bbs.archlinux.org/"
BUG_REPORT_URL="https://gitlab.archlinux.org/groups/archlinux/-/issues"
PRIVACY_POLICY_URL="https://terms.archlinux.org/docs/privacy-policy/"
LOGO=archlinux-logo
`.trim();

describe('getOsDetails()', () => {
  it('returns null on non-Linux platforms', async () => {
    vi.resetModules();
    vi.doMock('fs', () => ({
      readFileSync: vi.fn(),
    }));
    // Mock process.platform to darwin
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: 'darwin' });
    try {
      const { getOsDetails } = await import('../../../lib/telemetry/os_details');
      assert.strictEqual(getOsDetails(), null);
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  describe('Linux /etc/os-release parsing', () => {
    it('parses os-release and extracts allowed fields', async () => {
      vi.resetModules();
      vi.doMock('fs', () => ({
        readFileSync: vi.fn().mockImplementation((path: string) => {
          if (path === '/etc/os-release') {
            return MOCK_OS_RELEASE;
          }
          throw new Error('ENOENT');
        }),
      }));
      // Mock process.platform to linux
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });
      try {
        const { getOsDetails } = await import('../../../lib/telemetry/os_details');
        assert.deepStrictEqual(getOsDetails(), {
          NAME: 'Arch Linux',
          PRETTY_NAME: 'Arch Linux',
          ID: 'arch',
          BUILD_ID: 'rolling',
          VERSION_ID: '20251019.0.436919',
        });
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      }
    });

    it('returns null when file read fails', async () => {
      vi.resetModules();
      vi.doMock('fs', () => ({
        readFileSync: vi.fn().mockImplementation(() => {
          throw new Error('read error');
        }),
      }));
      // Mock process.platform to linux
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });
      try {
        const { getOsDetails } = await import('../../../lib/telemetry/os_details');
        assert.strictEqual(getOsDetails(), null);
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      }
    });
  });
});
