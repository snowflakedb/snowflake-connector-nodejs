import assert from 'assert';
import sinon from 'sinon';
import fs from 'fs';
import rewiremock from 'rewiremock/node';

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
  afterEach(() => sinon.restore());

  function getFreshModule() {
    return rewiremock.proxy('../../lib/os_details') as typeof import('../../lib/os_details');
  }

  it('returns null on non-Linux platforms', () => {
    sinon.stub(process, 'platform').value('darwin');
    const { getOsDetails } = getFreshModule();
    assert.strictEqual(getOsDetails(), null);
  });

  describe('Linux /etc/os-release parsing', () => {
    function stubOsReleaseFile(content: string | Error) {
      const originalReadFileSync = fs.readFileSync;
      sinon.stub(fs, 'readFileSync').callsFake((path, ...args) => {
        if (path === '/etc/os-release') {
          if (content instanceof Error) {
            throw content;
          }
          return content;
        }
        return originalReadFileSync(path, ...args);
      });
    }

    it('parses os-release and extracts allowed fields', () => {
      sinon.stub(process, 'platform').value('linux');
      stubOsReleaseFile(MOCK_OS_RELEASE);
      const { getOsDetails } = getFreshModule();
      assert.deepStrictEqual(getOsDetails(), {
        NAME: 'Arch Linux',
        PRETTY_NAME: 'Arch Linux',
        ID: 'arch',
        BUILD_ID: 'rolling',
        VERSION_ID: '20251019.0.436919',
      });
    });

    it('returns null when file read fails', () => {
      sinon.stub(process, 'platform').value('linux');
      stubOsReleaseFile(new Error('read error'));
      const { getOsDetails } = getFreshModule();
      assert.strictEqual(getOsDetails(), null);
    });
  });
});
