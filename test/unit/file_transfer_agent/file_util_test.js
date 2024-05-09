/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const testUtil = require('../../integration/testUtil');
const os = require('os');
const fsPromises = require('fs').promises;
const crypto = require('crypto');
const getMatchingFilePaths = require('../../../lib/file_transfer_agent/file_util').getMatchingFilePaths;


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
