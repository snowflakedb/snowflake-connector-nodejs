const assert = require('assert');
const testUtil = require('../../integration/testUtil');
const os = require('os');
const fsPromises = require('fs').promises;
const crypto = require('crypto');
const {
  globToRegex,
  getMatchingFilePaths,
  isFileNotWritableByGroupOrOthers,
  validateNoExtraPermissionsForOthers,
  isFileModeCorrect,
  FileUtil,
} = require('../../../lib/file_util');
const path = require('path');

describe('FileUtil.getDigestAndSizeForFile()', function () {
  it('computes SHA-256 digest (base64) and size', async function () {
    const fileUtil = new FileUtil();
    const tmpFilePath = path.join(os.tmpdir(), `digest_${crypto.randomUUID()}`);
    const content = Buffer.from('snowflake-nodejs-digest-test');

    await fsPromises.writeFile(tmpFilePath, content);
    try {
      const result = await fileUtil.getDigestAndSizeForFile(tmpFilePath);
      const expectedDigest = crypto.createHash('sha256').update(content).digest('base64');
      assert.strictEqual(result.digest, expectedDigest);
      assert.strictEqual(result.size, content.length);
    } finally {
      await fsPromises.rm(tmpFilePath, { force: true });
    }
  });
});

describe('globToRegex', function () {
  const files = ['matched.gzip', 'matched2.gzip', 'matched.txt', 'notmatched.txt'];
  const testCases = [
    {
      pattern: 'ma*',
      expectedMatches: ['matched.gzip', 'matched2.gzip', 'matched.txt'],
    },
    {
      pattern: 'matche*.gzip',
      expectedMatches: ['matched.gzip', 'matched2.gzip'],
    },
    {
      pattern: 'matched.gzip*',
      expectedMatches: ['matched.gzip'],
    },
    {
      pattern: 'matche?.gzip',
      expectedMatches: ['matched.gzip'],
    },
    {
      pattern: 'm?t?he*',
      expectedMatches: ['matched.gzip', 'matched2.gzip', 'matched.txt'],
    },
  ];
  for (const { pattern, expectedMatches } of testCases) {
    it(`${pattern} should match ${expectedMatches.join(', ')}`, () => {
      const regex = globToRegex(pattern);
      const matchedFiles = files.filter((file) => regex.test(file));
      assert.deepStrictEqual(matchedFiles, expectedMatches);
    });
  }
});

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
      testFilePath = await testUtil.createTempFileAsync(
        os.tmpdir(),
        testUtil.createRandomFileName(),
      );
    });

    after(async function () {
      await fsPromises.rm(testFilePath);
    });

    [
      {
        permission: '600',
        expectedResult: true,
      },
      {
        permission: '100600',
        expectedResult: true,
      },
      {
        permission: '700',
        expectedResult: false,
      },
      {
        permission: '640',
        // 640 gives owner read+write and group read - validateNoExtraPermissionsForOthers
        // only warns about read permissions but doesn't throw
        expectedResult: true,
      },
      {
        permission: '100777',
        expectedResult: false,
      },
      {
        permission: '444',
        expectedResult: false,
      },
      {
        permission: '12477',
        expectedResult: false,
      },
    ].forEach(({ permission, expectedResult }) => {
      it(`verify permission ${permission}`, async function () {
        await fsPromises.chmod(testFilePath, permission);
        if (!expectedResult) {
          await assert.rejects(() => validateNoExtraPermissionsForOthers(testFilePath));
        } else {
          await assert.doesNotReject(() => validateNoExtraPermissionsForOthers(testFilePath));
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
      it(
        'File with permission: ' + filePerm.toString(8) + ' should be valid=' + isValid,
        async function () {
          const filePath = path.join(tempDir, `file_${filePerm.toString()}`);
          await writeFile(filePath, filePerm);
          assert.strictEqual(await isFileNotWritableByGroupOrOthers(filePath, fsPromises), isValid);
        },
      );
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
      it(
        'Should return ' +
          isCorrect +
          ' when directory permission ' +
          dirPerm.toString(8) +
          ' is compared to ' +
          expectedPerm.toString(8),
        async function () {
          const dirPath = path.join(tempDir, `dir_${dirPerm.toString(8)}`);
          await fsPromises.mkdir(dirPath, { mode: dirPerm });
          assert.strictEqual(await isFileModeCorrect(dirPath, expectedPerm, fsPromises), isCorrect);
        },
      );
    });

    [
      { filePerm: 0o700, expectedPerm: 0o700, isCorrect: true },
      { filePerm: 0o755, expectedPerm: 0o600, isCorrect: false },
    ].forEach(async function ({ filePerm, expectedPerm, isCorrect }) {
      it(
        'Should return ' +
          isCorrect +
          ' when file permission ' +
          filePerm.toString(8) +
          ' is compared to ' +
          expectedPerm.toString(8),
        async function () {
          const dirPath = path.join(tempDir, `file_${filePerm.toString(8)}`);
          await fsPromises.appendFile(dirPath, '', { mode: filePerm });
          assert.strictEqual(await isFileModeCorrect(dirPath, expectedPerm, fsPromises), isCorrect);
        },
      );
    });
  });
}

describe('FileUtil.normalizeGzipHeader()', function () {
  let fileUtil;
  let tempDir;

  before(async function () {
    fileUtil = new FileUtil();
    tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'gzip_test_'));
  });

  after(async function () {
    if (tempDir) {
      await fsPromises.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('resets timestamp bytes to zero in gzip header', async function () {
    const testFile = path.join(tempDir, 'test.gz');

    // Create a mock gzip file with a non-zero timestamp
    // Gzip header: ID1(0x1f) + ID2(0x8b) + CM(0x08) + FLG(0x00) + MTIME(4 bytes) + XFL + OS
    const gzipHeader = Buffer.from([
      0x1f,
      0x8b,
      0x08,
      0x00, // Standard gzip header
      0x12,
      0x34,
      0x56,
      0x78, // Timestamp (non-zero)
      0x00,
      0x03, // XFL + OS
    ]);

    // Add some dummy compressed data to make it a valid-ish gzip file
    const dummyData = Buffer.from([0x01, 0x00, 0x00, 0xff, 0xff, 0x00, 0x00, 0x00, 0x00]);
    const gzipFile = Buffer.concat([gzipHeader, dummyData]);

    await fsPromises.writeFile(testFile, gzipFile);

    // Verify the timestamp bytes are non-zero before normalization
    const beforeBuffer = await fsPromises.readFile(testFile);
    assert.notStrictEqual(beforeBuffer[4], 0);
    assert.notStrictEqual(beforeBuffer[5], 0);
    assert.notStrictEqual(beforeBuffer[6], 0);
    assert.notStrictEqual(beforeBuffer[7], 0);

    // Normalize the header
    await fileUtil.normalizeGzipHeader(testFile);

    // Verify the timestamp bytes are now zero
    const afterBuffer = await fsPromises.readFile(testFile);
    assert.strictEqual(afterBuffer[4], 0);
    assert.strictEqual(afterBuffer[5], 0);
    assert.strictEqual(afterBuffer[6], 0);
    assert.strictEqual(afterBuffer[7], 0);

    // Verify other header bytes remain unchanged
    assert.strictEqual(afterBuffer[0], 0x1f);
    assert.strictEqual(afterBuffer[1], 0x8b);
    assert.strictEqual(afterBuffer[2], 0x08);
    assert.strictEqual(afterBuffer[3], 0x00);
    assert.strictEqual(afterBuffer[8], 0x00);
    assert.strictEqual(afterBuffer[9], 0x03);
  });
});
