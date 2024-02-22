/*
 * Copyright (c) 2024 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const testUtil = require('../../integration/testUtil');
const os = require('os');
const fsPromises = require('fs').promises;
const crypto = require('crypto');
const FileUtil = require('../../../lib/file_transfer_agent/file_util').FileUtil;

const SnowflakeFileUtil = new FileUtil();

describe('matching files by wildcard', function () {
  const randomName = crypto.randomUUID();
  const excpetedNomberOfMatchedFiles = 3;

  async function clean(randomName) {
    const matchedFiles = SnowflakeFileUtil.getMatchingFilePaths(os.tmpdir(), `${randomName}matched` + '*');
    const notmatchedFiles = SnowflakeFileUtil.getMatchingFilePaths(os.tmpdir(), `${randomName}notmatched` + '*');

    for (const filePath of matchedFiles) {
      await fsPromises.rm(filePath);
    }
    for (const filePath of notmatchedFiles) {
      await fsPromises.rm(filePath);
    }
  }

  async function createFiles(randomName, options) {
    for (let i = 0; i < excpetedNomberOfMatchedFiles; i++) {
      await testUtil.createTempFileAsync(os.tmpdir(), testUtil.createRandomFileName(options));
    }
  }

  after(function () {
    clean(randomName);
  });

  it('match paths with prefix', async function () {
    await createFiles(randomName, { prefix: `${randomName}matched` });
    await createFiles(randomName, { prefix: `${randomName}notmatched` });
    const matched = SnowflakeFileUtil.getMatchingFilePaths(os.tmpdir(), `${randomName}matched` + '*');
    assert.strictEqual(matched.length, excpetedNomberOfMatchedFiles);
  });

  it('match paths with prefix and extension', async function () {
    await createFiles(randomName, { prefix: `${randomName}matched`, extension: '.gz' });
    await createFiles(randomName, { prefix: `${randomName}matched`, extension: '.txt' });
    await createFiles(randomName, { prefix: `${randomName}notmatched` });
    const matched = SnowflakeFileUtil.getMatchingFilePaths(os.tmpdir(), `${randomName}matched` + '*.gz');
    assert.strictEqual(matched.length, excpetedNomberOfMatchedFiles);
  });

});
