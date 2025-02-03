/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const testUtil = require('../../integration/testUtil');
const os = require('os');
const fsPromises = require('fs').promises;
const crypto = require('crypto');
const { getMatchingFilePaths, isFileNotWritableByGroupOrOthers,
  validateOnlyUserReadWritePermissionAndOwner, isFileModeCorrect
} = require('../../../lib/file_util');
const path = require('path');


describe('matching files by wildcard', function () {
  const randomName = crypto.randomUUID();
  const excpetedNomberOfMatchedFiles = 3;

  async function createFiles(options) {
    for (let i = 0; i < excpetedNomberOfMatchedFiles; i++) {
      await testUtil.createTempFileAsync(os.tmpdir(), testUtil.createRandomFileName(options));
    }
  }

  after(async function () {
    const matchedFiles = getMatchingFilePaths(os.tmpdir(), `${randomName}matched` + '*');
    const notmatchedFiles = getMatchingFilePaths(os.tmpdir(), `${randomName}notmatched` + '*');
    const promises = [];

    for (const filePath of matchedFiles) {
      promises.push(fsPromises.rm(filePath));
    }
    for (const filePath of notmatchedFiles) {
      promises.push(fsPromises.rm(filePath));
    }
    await Promise.all(promises);
  });

  it('match paths with prefix', async function () {
    await createFiles({ prefix: `${randomName}matched` });
    await createFiles({ prefix: `${randomName}notmatched` });
    const matched = getMatchingFilePaths(os.tmpdir(), `${randomName}matched` + '*');
    assert.strictEqual(matched.length, excpetedNomberOfMatchedFiles);
  });

  it('match paths with prefix and extension', async function () {
    await createFiles({ prefix: `${randomName}matched`, extension: '.gz' });
    await createFiles({ prefix: `${randomName}matched`, extension: '.txt' });
    await createFiles({ prefix: `${randomName}notmatched` });
    const matched = getMatchingFilePaths(os.tmpdir(), `${randomName}matched` + '*.gz');
    assert.strictEqual(matched.length, excpetedNomberOfMatchedFiles);
  });

});

if (os.platform() !== 'win32') {
  describe('verify only user read/write permission', function () {
    let testFilePath;

    before(async function () {
      testFilePath = await testUtil.createTempFileAsync(os.tmpdir(), testUtil.createRandomFileName());
    });

    after(async function () {
      await fsPromises.rm(testFilePath);
    });

    [
      {
        permission: '600',
        expectedResult: true
      },
      {
        permission: '100600',
        expectedResult: true
      },
      {
        permission: '700',
        expectedResult: false
      },
      {
        permission: '640',
        expectedResult: false
      },
      {
        permission: '100777',
        expectedResult: false
      },
      {
        permission: '444',
        expectedResult: false
      },
      {
        permission: '12477',
        expectedResult: false
      }
    ].forEach(({ permission, expectedResult }) => {
      it(`verify permission ${permission}`, async function () {
        await fsPromises.chmod(testFilePath, permission);
        if (!expectedResult) {
          assert.rejects( () =>  validateOnlyUserReadWritePermissionAndOwner(testFilePath));
        } else {
          assert.doesNotReject( () =>  validateOnlyUserReadWritePermissionAndOwner(testFilePath));
        }
      });
    });
  });
}

if (os.platform() !== 'win32') {
  describe('FileUtil.isFileNotWritableByGroupOrOthers()', function () {
    let tempDir = null;
    let oldMask = null;

    before(async function () {
      tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'permission_tests'));
      oldMask = process.umask(0o000);
    });

    after(async function () {
      await fsPromises.rm(tempDir, { recursive: true, force: true });
      process.umask(oldMask);
    });

    [
      { filePerm: 0o700, isValid: true },
      { filePerm: 0o600, isValid: true },
      { filePerm: 0o500, isValid: true },
      { filePerm: 0o400, isValid: true },
      { filePerm: 0o300, isValid: true },
      { filePerm: 0o200, isValid: true },
      { filePerm: 0o100, isValid: true },
      { filePerm: 0o707, isValid: false },
      { filePerm: 0o706, isValid: false },
      { filePerm: 0o705, isValid: true },
      { filePerm: 0o704, isValid: true },
      { filePerm: 0o703, isValid: false },
      { filePerm: 0o702, isValid: false },
      { filePerm: 0o701, isValid: true },
      { filePerm: 0o770, isValid: false },
      { filePerm: 0o760, isValid: false },
      { filePerm: 0o750, isValid: true },
      { filePerm: 0o740, isValid: true },
      { filePerm: 0o730, isValid: false },
      { filePerm: 0o720, isValid: false },
      { filePerm: 0o710, isValid: true },
    ].forEach(async function ({ filePerm, isValid }) {
      it('File with permission: ' + filePerm.toString(8) + ' should be valid=' + isValid, async function () {
        const filePath = path.join(tempDir, `file_${filePerm.toString()}`);
        await writeFile(filePath, filePerm);
        assert.strictEqual(await isFileNotWritableByGroupOrOthers(filePath, fsPromises), isValid);
      });
    });

    async function writeFile(filePath, mode) {
      await fsPromises.writeFile(filePath, '', { encoding: 'utf8', mode: mode });
    }
  });
}

if (os.platform() !== 'win32') {
  describe('FileUtil.isFileModeCorrect()', function () {
    const tempDir = path.join(os.tmpdir(), 'permission_tests');
    let oldMask = null;

    before(async function () {
      await fsPromises.mkdir(tempDir);
      oldMask = process.umask(0o000);
    });

    after(async function () {
      await fsPromises.rm(tempDir, { recursive: true, force: true });
      process.umask(oldMask);
    });

    [
      { dirPerm: 0o700, expectedPerm: 0o700, isCorrect: true },
      { dirPerm: 0o755, expectedPerm: 0o600, isCorrect: false },
    ].forEach(async function ({ dirPerm, expectedPerm, isCorrect }) {
      it('Should return ' + isCorrect + ' when directory permission ' + dirPerm.toString(8) + ' is compared to ' + expectedPerm.toString(8), async function () {
        const dirPath = path.join(tempDir, `dir_${dirPerm.toString(8)}`);
        await fsPromises.mkdir(dirPath, { mode: dirPerm });
        assert.strictEqual(await isFileModeCorrect(dirPath, expectedPerm, fsPromises), isCorrect);
      });
    });

    [
      { filePerm: 0o700, expectedPerm: 0o700, isCorrect: true },
      { filePerm: 0o755, expectedPerm: 0o600, isCorrect: false },
    ].forEach(async function ({ filePerm, expectedPerm, isCorrect }) {
      it('Should return ' + isCorrect + ' when file permission ' + filePerm.toString(8) + ' is compared to ' + expectedPerm.toString(8), async function () {
        const dirPath = path.join(tempDir, `file_${filePerm.toString(8)}`);
        await fsPromises.appendFile(dirPath, '', { mode: filePerm });
        assert.strictEqual(await isFileModeCorrect(dirPath, expectedPerm, fsPromises), isCorrect);
      });
    });
  });
}

