import rewiremock from 'rewiremock/node';
import assert from 'assert';
import sinon from 'sinon';
import fs from 'fs';
import childProcess from 'child_process';

describe('getLibcDetails()', () => {
  afterEach(() => sinon.restore());

  function getFreshModule() {
    return rewiremock.proxy(
      '../../lib/telemetry/libc_details',
    ) as typeof import('../../lib/telemetry/libc_details');
  }

  function stubLddRead(result: string | Error) {
    const originalReadFileSync = fs.readFileSync;
    return sinon.stub(fs, 'readFileSync').callsFake((path: any, options?: any) => {
      if (path === '/usr/bin/ldd') {
        if (result instanceof Error) {
          throw result;
        }
        return result;
      }
      return originalReadFileSync(path, options);
    });
  }

  it('returns empty details on non-Linux', () => {
    sinon.stub(process, 'platform').value('darwin');
    const { getLibcDetails } = getFreshModule();
    assert.deepStrictEqual(getLibcDetails(), { family: null, version: null });
  });

  it('detects glibc from filesystem', () => {
    sinon.stub(process, 'platform').value('linux');
    stubLddRead('GNU C Library (Ubuntu GLIBC 2.31-0ubuntu9.16) stable release version 2.31.');
    const { getLibcDetails } = getFreshModule();
    assert.deepStrictEqual(getLibcDetails(), { family: 'glibc', version: '2.31' });
  });

  it('detects musl from filesystem', () => {
    sinon.stub(process, 'platform').value('linux');
    stubLddRead('musl libc (x86_64)\nVersion 1.2.3');
    const { getLibcDetails } = getFreshModule();
    assert.deepStrictEqual(getLibcDetails(), { family: 'musl', version: '1.2.3' });
  });

  it('detects musl from filesystem without version', () => {
    sinon.stub(process, 'platform').value('linux');
    sinon.stub(process, 'report').value(undefined);
    sinon.stub(childProcess, 'execSync').throws(new Error('command not found'));
    stubLddRead('musl libc (x86_64)');
    const { getLibcDetails } = getFreshModule();
    assert.deepStrictEqual(getLibcDetails(), { family: 'musl', version: null });
  });

  it('detects glibc from process report when filesystem fails', () => {
    sinon.stub(process, 'platform').value('linux');
    const fakeReport = {
      getReport: () => ({
        header: { glibcVersionRuntime: '2.28' },
        sharedObjects: [],
      }),
      excludeNetwork: false,
    };
    sinon.stub(process, 'report').value(fakeReport);
    stubLddRead(new Error('ENOENT'));
    const { getLibcDetails } = getFreshModule();
    assert.deepStrictEqual(getLibcDetails(), { family: 'glibc', version: '2.28' });
  });

  it('detects musl from process report when filesystem and command fail', () => {
    sinon.stub(process, 'platform').value('linux');
    const fakeReport = {
      getReport: () => ({
        header: {},
        sharedObjects: ['/lib/ld-musl-x86_64.so.1', '/lib/libc.musl-x86_64.so.1'],
      }),
      excludeNetwork: false,
    };
    sinon.stub(process, 'report').value(fakeReport);
    sinon.stub(childProcess, 'execSync').throws(new Error('command not found'));
    stubLddRead(new Error('ENOENT'));
    const { getLibcDetails } = getFreshModule();
    assert.deepStrictEqual(getLibcDetails(), { family: 'musl', version: null });
  });

  it('detects musl family from report and version from command', () => {
    sinon.stub(process, 'platform').value('linux');
    const fakeReport = {
      getReport: () => ({
        header: {},
        sharedObjects: ['/lib/ld-musl-x86_64.so.1', '/lib/libc.musl-x86_64.so.1'],
      }),
      excludeNetwork: false,
    };
    sinon.stub(process, 'report').value(fakeReport);
    sinon
      .stub(childProcess, 'execSync')
      .returns('getconf: UNKNOWN variable GNU_LIBC_VERSION\nmusl libc (x86_64)\nVersion 1.2.5');
    stubLddRead(new Error('ENOENT'));
    const { getLibcDetails } = getFreshModule();
    assert.deepStrictEqual(getLibcDetails(), { family: 'musl', version: '1.2.5' });
  });

  it('detects glibc from command when filesystem and report fail', () => {
    sinon.stub(process, 'platform').value('linux');
    sinon.stub(process, 'report').value(undefined);
    sinon.stub(childProcess, 'execSync').returns('glibc 2.17\nldd (GNU libc) 2.17');
    stubLddRead(new Error('ENOENT'));
    const { getLibcDetails } = getFreshModule();
    assert.deepStrictEqual(getLibcDetails(), { family: 'glibc', version: '2.17' });
  });

  it('detects musl from command when filesystem and report fail', () => {
    sinon.stub(process, 'platform').value('linux');
    sinon.stub(process, 'report').value(undefined);
    sinon
      .stub(childProcess, 'execSync')
      .returns('getconf: UNKNOWN variable GNU_LIBC_VERSION\nmusl libc (x86_64)\nVersion 1.2.2');
    stubLddRead(new Error('ENOENT'));
    const { getLibcDetails } = getFreshModule();
    assert.deepStrictEqual(getLibcDetails(), { family: 'musl', version: '1.2.2' });
  });

  it('returns empty details when all detection methods fail', () => {
    sinon.stub(process, 'platform').value('linux');
    sinon.stub(process, 'report').value(undefined);
    sinon.stub(childProcess, 'execSync').throws(new Error('command not found'));
    stubLddRead(new Error('ENOENT'));
    const { getLibcDetails } = getFreshModule();
    assert.deepStrictEqual(getLibcDetails(), { family: null, version: null });
  });

  it('caches the result after first call', () => {
    sinon.stub(process, 'platform').value('linux');
    const readStub = stubLddRead(
      'GNU C Library (Ubuntu GLIBC 2.31-0ubuntu9.16) stable release version 2.31.',
    );
    const { getLibcDetails } = getFreshModule();
    const first = getLibcDetails();
    const second = getLibcDetails();
    assert.deepStrictEqual(first, { family: 'glibc', version: '2.31' });
    assert.strictEqual(first, second);
    assert.strictEqual(readStub.getCalls().filter((c) => c.args[0] === '/usr/bin/ldd').length, 1);
  });
});
