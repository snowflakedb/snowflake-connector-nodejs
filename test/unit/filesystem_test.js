/*
 * Security regression tests for disabling driver filesystem access.
 * Reference: blockFilesystemAccess hardening
 */
const assert = require('assert');
const nativeFs = require('fs');
const sinon = require('sinon');
const snowflake = require('../../lib/snowflake').default;
const guardedFs = require('../../lib/filesystem');
const ErrorCodes = require('../../lib/errors').codes;
const FileTransferAgent = require('../../lib/file_transfer_agent/file_transfer_agent');

describe('blockFilesystemAccess', function () {
  afterEach(function () {
    snowflake.configure({ blockFilesystemAccess: false });
    sinon.restore();
  });

  it('blocks synchronous filesystem operations before they reach Node.js', function () {
    const readFileSync = sinon.stub(nativeFs, 'readFileSync').returns('contents');
    snowflake.configure({ blockFilesystemAccess: true });

    assert.throws(
      () => guardedFs.readFileSync('ignored'),
      (error) => error.code === ErrorCodes.ERR_FILESYSTEM_ACCESS_BLOCKED,
    );
    assert.strictEqual(readFileSync.called, false);
  });

  it('blocks asynchronous filesystem operations before they reach Node.js', async function () {
    const readFile = sinon.stub(nativeFs.promises, 'readFile').resolves(Buffer.from('contents'));
    snowflake.configure({ blockFilesystemAccess: true });

    await assert.rejects(
      async () => await guardedFs.promises.readFile('ignored'),
      (error) => error.code === ErrorCodes.ERR_FILESYSTEM_ACCESS_BLOCKED,
    );
    assert.strictEqual(readFile.called, false);
  });

  it('allows filesystem operations when the option is disabled', function () {
    const readFileSync = sinon.stub(nativeFs, 'readFileSync').returns('contents');
    snowflake.configure({ blockFilesystemAccess: false });

    assert.strictEqual(guardedFs.readFileSync('ignored'), 'contents');
    assert.strictEqual(readFileSync.calledOnce, true);
  });

  it('does not affect filesystem access outside the guarded module', function () {
    const readFileSync = sinon.stub(nativeFs, 'readFileSync').returns('contents');
    snowflake.configure({ blockFilesystemAccess: true });

    assert.strictEqual(nativeFs.readFileSync('ignored'), 'contents');
    assert.strictEqual(readFileSync.calledOnce, true);
  });

  it('blocks PUT file source discovery', async function () {
    snowflake.configure({ blockFilesystemAccess: true });
    const agent = new FileTransferAgent({
      connectionConfig: {},
      fileMetadata: {
        data: {
          command: 'UPLOAD',
          src_locations: ['ignored.txt'],
        },
      },
      sqlText: 'PUT file://ignored.txt @~',
    });

    await assert.rejects(
      async () => await agent.execute(),
      (error) => error.code === ErrorCodes.ERR_FILESYSTEM_ACCESS_BLOCKED,
    );
  });

  it('blocks GET destination discovery', async function () {
    snowflake.configure({ blockFilesystemAccess: true });
    const agent = new FileTransferAgent({
      connectionConfig: {},
      fileMetadata: {
        data: {
          command: 'DOWNLOAD',
          localLocation: 'ignored',
          src_locations: [],
        },
      },
      sqlText: 'GET @~ file://ignored',
    });

    await assert.rejects(
      async () => await agent.execute(),
      (error) => error.code === ErrorCodes.ERR_FILESYSTEM_ACCESS_BLOCKED,
    );
  });
});
