/*
 * Copyright (c) 2023 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const testUtil = require('../../integration/testUtil');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');
const getMatchingFilePaths = require('./../../../lib/file_transfer_agent/file_transfer_agent').getMatchingFilePaths;


function clean(randomName) {
  const matchedFiles = getMatchingFilePaths(os.tmpdir(), `${randomName}matched` + '*', 'win32');
  const notmatchedFiles = getMatchingFilePaths(os.tmpdir(), `${randomName}notmatched` + '*', 'win32');

  matchedFiles.forEach(filePath => {
    fs.rmSync(filePath);
  });
  notmatchedFiles.forEach(filePath => {
    fs.rmSync(filePath);
  });
}

function createFiles(randomName, options) {
  for (let i = 0; i < 3; i++) {
    testUtil.createTempFile(os.tmpdir(), testUtil.createRandomFileName(options));
  }
}
describe('matching files by wildcard', function () {
  const randomName = crypto.randomUUID();

  after(function () {
    clean(randomName);
  });

  it('match paths with prefix', async function () {
    createFiles(randomName, { prefix: `${randomName}matched` });
    createFiles(randomName, { prefix: `${randomName}notmatched` });
    const matched = getMatchingFilePaths(os.tmpdir(), `${randomName}matched` + '*');
    assert(matched.length === 3);
  });

  it('match paths with prefix and extension', async function () {
    createFiles(randomName, { prefix: `${randomName}matched`, extension: '.gz' });
    createFiles(randomName, { prefix: `${randomName}matched`, extension: '.txt' });
    createFiles(randomName, { prefix: `${randomName}notmatched` });
    const matched = getMatchingFilePaths(os.tmpdir(), `${randomName}matched` + '*.gz');
    assert(matched.length === 3);
  });

});
