import assert from 'assert';
import os from 'os';
import path from 'path';
import sinon from 'sinon';
import { getDefaultCacheDir } from '../../lib/disk_cache';

describe('getDefaultCacheDir', function () {
  afterEach(() => sinon.restore());

  it('returns correct path for win32', function () {
    sinon.stub(process, 'platform').value('win32');
    sinon.stub(os, 'homedir').returns('/mock/home');
    assert.strictEqual(
      getDefaultCacheDir(),
      path.join('/mock/home', 'AppData', 'Local', 'Snowflake', 'Caches'),
    );
  });

  it('returns correct path for linux', function () {
    sinon.stub(process, 'platform').value('linux');
    sinon.stub(os, 'homedir').returns('/mock/home');
    assert.strictEqual(getDefaultCacheDir(), path.join('/mock/home', '.cache', 'snowflake'));
  });

  it('returns correct path for darwin', function () {
    sinon.stub(process, 'platform').value('darwin');
    sinon.stub(os, 'homedir').returns('/mock/home');
    assert.strictEqual(getDefaultCacheDir(), path.join('/mock/home', 'Library'));
  });

  it('throws for unsupported platform', function () {
    sinon.stub(process, 'platform').value('freebsd');
    assert.throws(() => getDefaultCacheDir(), /Unsupported platform: freebsd/);
  });

  it('falls back to os.tmpdir() when os.homedir() throws', function () {
    sinon.stub(process, 'platform').value('linux');
    sinon.stub(os, 'homedir').throws(new Error('no home directory'));
    sinon.stub(os, 'tmpdir').returns('/tmp');
    assert.strictEqual(getDefaultCacheDir(), path.join('/tmp', '.cache', 'snowflake'));
  });
});
