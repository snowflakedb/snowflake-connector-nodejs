const assert = require('assert');
const async = require('async');
const connOption = require('./connectionOptions');
const fileCompressionType = require('./../../lib/file_transfer_agent/file_compression_type');
const fs = require('fs');
const testUtil = require('./testUtil');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { randomizeName } = require('./testUtil');

const DATABASE_NAME = connOption.valid.database;
const SCHEMA_NAME = connOption.valid.schema;

const SKIPPED = 'SKIPPED';
const UPLOADED = 'UPLOADED';
const DOWNLOADED = 'DOWNLOADED';

const COL1 = 'C1';
const COL2 = 'C2';
const COL3 = 'C3';
const COL1_DATA = 'FIRST';
const COL2_DATA = 'SECOND';
const COL3_DATA = 'THIRD';
const ROW_DATA =
  COL1_DATA + ',' + COL2_DATA + ',' + COL3_DATA + '\n' +
  COL1_DATA + ',' + COL2_DATA + ',' + COL3_DATA + '\n' +
  COL1_DATA + ',' + COL2_DATA + ',' + COL3_DATA + '\n' +
  COL1_DATA + ',' + COL2_DATA + ',' + COL3_DATA + '\n';
const ROW_DATA_SIZE = 76;

const ROW_DATA_OVERWRITE = COL3_DATA + ',' + COL1_DATA + ',' + COL2_DATA + '\n';
const ROW_DATA_OVERWRITE_SIZE = 19;

function getPlatformTmpPath(tmpPath) {
  let location = `file://${tmpPath}`;
  // Windows user contains a '~' in the path which causes an error
  if (process.platform === 'win32') {
    const fileName = path.basename(tmpPath);
    location = `file://${process.env.USERPROFILE}\\AppData\\Local\\Temp\\${fileName}`;
  }
  return location;
}

function getRelativePlatformTmpFilePath(tmpPath) {
  const fileName = path.basename(tmpPath);
  let location = `file://./${fileName}`;
  if (process.platform === 'win32') {
    location = `file://.\\${fileName}`;
  }
  return location;
}

function executePutCmd(connection, putQuery, callback, results) {
  // Upload file
  connection.execute({
    sqlText: putQuery,
    complete: function (err, stmt) {
      const stream = stmt.streamRows();
      stream.on('error', function (err) {
        callback(err);
      });
      stream.on('data', function (row) {
        results.fileSize = row.targetSize;
        // Check the file is correctly uploaded
        assert.strictEqual(row['status'], UPLOADED);
        // Check the target encoding is correct
        assert.strictEqual(row['targetCompression'], 'GZIP');
      });
      stream.on('end', function () {
        callback();
      });
    }
  });
}

describe('PUT GET test', function () {
  this.retries(3); // this test suit are considered as flaky test
  let connection;
  let tmpFile;
  const TEMP_TABLE_NAME = randomizeName('TEMP_TABLE');
  const createTable = `create or replace table ${TEMP_TABLE_NAME} (${COL1} STRING, ${COL2} STRING, ${COL3} STRING)`;
  const truncateTable = `truncate table if exists ${TEMP_TABLE_NAME}`;
  const copyInto = `COPY INTO ${TEMP_TABLE_NAME}`;
  const removeFile = `REMOVE @${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME}`;
  const dropTable = `DROP TABLE IF EXISTS ${TEMP_TABLE_NAME}`;

  before(async () => {
    connection = testUtil.createConnection();
    await testUtil.connectAsync(connection);
    await testUtil.executeCmdAsync(connection, createTable);
  });

  beforeEach(async () => {
    await testUtil.executeCmdAsync(connection, truncateTable);
  });

  afterEach(async () => {
    testUtil.deleteFileSyncIgnoringErrors(tmpFile);
    await testUtil.executeCmdAsync(connection, removeFile);
  });

  after(async () => {
    await testUtil.executeCmdAsync(connection, dropTable);
    await testUtil.destroyConnectionAsync(connection);
  });

  const testCases =
    [
      {
        name: 'gzip',
        encoding: fileCompressionType.lookupByMimeSubType('gzip'),
      },
      {
        name: 'bzip2',
        encoding: fileCompressionType.lookupByMimeSubType('bz2'),
      },
      {
        name: 'brotli',
        encoding: fileCompressionType.lookupByMimeSubType('br'),
      },
      {
        name: 'deflate',
        encoding: fileCompressionType.lookupByMimeSubType('deflate'),
      },
      {
        name: 'raw deflate',
        encoding: fileCompressionType.lookupByMimeSubType('raw_deflate'),
      },
      {
        name: 'zstd',
        encoding: fileCompressionType.lookupByMimeSubType('zstd'),
      },
      {
        name: 'GziP', // Verify case insensitive
        encoding: fileCompressionType.lookupByMimeSubType('GziP'),
      }
    ];

  const createItCallback = function (testCase) {
    return function (done) {
      {
        // Create a temp file with specified file extension and Write row data to temp file
        tmpFile = testUtil.createTempFile(os.tmpdir(), 
          testUtil.createRandomFileName( { postfix: testCase.encoding['file_extension'] }), ROW_DATA);

        let putQuery = `PUT file://${tmpFile} @${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME}`;
        // Windows user contains a '~' in the path which causes an error
        if (process.platform === 'win32') {
          const fileName = path.basename(tmpFile);
          putQuery = `PUT file://${process.env.USERPROFILE}\\AppData\\Local\\Temp\\${fileName} @${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME}`;
        }

        // Create a tmp folder for downloaded files
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'get'));
        let fileSize;

        let getQuery = `GET @${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME} file://${tmpDir}`;
        // Windows user contains a '~' in the path which causes an error
        if (process.platform === 'win32') {
          const dirName = tmpDir.substring(tmpDir.lastIndexOf('\\') + 1);
          getQuery = `GET @${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME} file://${process.env.USERPROFILE}\\AppData\\Local\\Temp\\${dirName}`;
        }

        async.series(
          [
            function (callback) {
              // Upload file
              connection.execute({
                sqlText: putQuery,
                complete: function (err, _, rows) {
                  if (err) {
                    callback(err);
                  } else {
                    // example expected rows:
                    // [{"source":"tmp-69066-85e8r477L32w-.gz","target":"tmp-69066-85e8r477L32w-.gz","sourceSize":76,
                    //   "targetSize":76,"sourceCompression":null,"targetCompression":"GZIP","status":"UPLOADED"}]
                    const row = rows[0];
                    try {
                      fileSize = row['targetSize'];
                      // Check the file is correctly uploaded
                      assert.strictEqual(row['status'], UPLOADED);
                      // Check the target encoding is correct
                      assert.strictEqual(row['targetCompression'], testCase.encoding['name']);
                      callback();
                    } catch (e) {
                      callback(e);
                    }
                  }
                }
              });
            },
            function (callback) {
              // Copy into temp table
              testUtil.executeCmd(connection, copyInto, callback);
            },
            function (callback) {
              // Check the contents are correct
              connection.execute({
                sqlText: `SELECT * FROM ${TEMP_TABLE_NAME}`,
                complete: function (err, stmt) {
                  if (err) {
                    callback(err);
                  } else {
                    const stream = stmt.streamRows();
                    stream.on('error', function (err) {
                      callback(err);
                    });
                    stream.on('data', function (row) {
                      // Check the row data is correct
                      assert.strictEqual(row[COL1], COL1_DATA);
                      assert.strictEqual(row[COL2], COL2_DATA);
                      assert.strictEqual(row[COL3], COL3_DATA);
                    });
                    stream.on('end', function () {
                      callback();
                    });
                  }
                }
              });
            },
            function (callback) {
              // Check the row count is correct
              connection.execute({
                sqlText: `SELECT COUNT(*) FROM ${TEMP_TABLE_NAME}`,
                complete: function (err, stmt) {
                  if (err) {
                    callback(err);
                  } else {
                    const stream = stmt.streamRows();
                    stream.on('error', function (err) {
                      callback(err);
                    });
                    stream.on('data', function (row) {
                      // Check the row count is correct
                      assert.strictEqual(row['COUNT(*)'], 4);
                    });
                    stream.on('end', function () {
                      callback();
                    });
                  }
                }
              });
            },
            function (callback) {
              // Run GET command
              connection.execute({
                sqlText: getQuery,
                complete: function (err, stmt) {
                  if (err) {
                    callback(err);
                  } else {
                    const stream = stmt.streamRows();
                    stream.on('error', function (err) {
                      callback(err);
                    });
                    stream.on('data', function (row) {
                      assert.strictEqual(row.status, DOWNLOADED);
                      assert.strictEqual(row.size, fileSize);
                      // Delete the downloaded file
                      fs.unlink(path.join(tmpDir, row.file), (err) => {
                        if (err) {
                          throw (err);
                        }
                        // Delete the temporary folder
                        fs.rmdir(tmpDir, (err) => {
                          if (err) {
                            throw (err);
                          }
                        });
                      });
                    });
                    stream.on('end', function () {
                      callback();
                    });
                  }
                }
              });
            }
          ],
          done
        );
      }

    };
  };

  for (let index = 0; index < testCases.length; index++) {
    const testCase = testCases[index];
    it(testCase.name, createItCallback(testCase));
  }
});

describe('PUT GET overwrite test', function () {
  this.retries(3); // this test suit are considered as flaky test

  let connection;
  const TEMP_TABLE_NAME = randomizeName('TEMP_TABLE');
  const createTable = `create or replace table ${TEMP_TABLE_NAME} (${COL1} STRING, ${COL2} STRING, ${COL3} STRING)`;
  const removeFile = `REMOVE @${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME}`;
  const dropTable = `DROP TABLE IF EXISTS ${TEMP_TABLE_NAME}`;

  // Create a temp file without specified file extension and wwrite row data to temp file.

  const tmpFile = testUtil.createTempFile(os.tmpdir(), testUtil.createRandomFileName(), ROW_DATA);

  before(async () => {
    connection = testUtil.createConnection();
    await testUtil.connectAsync(connection);
    await testUtil.executeCmdAsync(connection, createTable);
  });

  after(async () => {
    testUtil.deleteFileSyncIgnoringErrors(tmpFile);

    await testUtil.executeCmdAsync(connection, removeFile);
    await testUtil.executeCmdAsync(connection, dropTable);
    await testUtil.destroyConnectionAsync(connection);
  });

  let putQuery = `
    PUT file://${tmpFile} @${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME} AUTO_COMPRESS=FALSE`;
  // Windows user contains a '~' in the path which causes an error
  if (process.platform === 'win32') {
    // const fileName = tmpFile.name.substring(tmpFile.name.lastIndexOf('\\'));
    const fileName = path.basename(tmpFile);
    putQuery = `
      PUT file://${process.env.USERPROFILE}\\AppData\\Local\\Temp\\${fileName} @${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME} AUTO_COMPRESS=FALSE`;
  }

  const testCases =
    [
      {
        name: 'overwrite'
      },
    ];

  const createItCallback = function () {
    return function (done) {
      {
        async.series(
          [
            function (callback) {
              connection.execute({
                sqlText: putQuery,
                complete: function (err, stmt) {
                  if (err) {
                    callback(err);
                  } else {
                    const stream = stmt.streamRows();
                    stream.on('error', function (err) {
                      callback(err);
                    });
                    stream.on('data', function (row) {
                      // Check the file is correctly uploaded
                      assert.strictEqual(row['status'], UPLOADED);
                      assert.strictEqual(row.targetSize, ROW_DATA_SIZE);
                    });
                    stream.on('end', function () {
                      callback();
                    });
                  }
                }
              });
            },
            function (callback) {
              connection.execute({
                sqlText: putQuery,
                complete: function (err, stmt) {
                  if (err) {
                    callback(err);
                  } else {
                    const stream = stmt.streamRows();
                    stream.on('error', function (err) {
                      callback(err);
                    });
                    stream.on('data', function (row) {
                      if (!connOption.account.includes('gcp')) {
                        // Check the file is correctly uploaded
                        assert.strictEqual(row['status'], SKIPPED);
                      }
                    });
                    stream.on('end', function () {
                      callback();
                    });
                  }
                }
              });
            },
            function (callback) {
              fs.writeFileSync(tmpFile, ROW_DATA_OVERWRITE);
              putQuery += ' OVERWRITE=TRUE';

              connection.execute({
                sqlText: putQuery,
                complete: function (err, stmt) {
                  if (err) {
                    callback(err);
                  } else {
                    const stream = stmt.streamRows();
                    stream.on('error', function (err) {
                      callback(err);
                    });
                    stream.on('data', function (row) {
                      // Check the file is correctly uploaded
                      assert.strictEqual(row['status'], UPLOADED);
                      assert.strictEqual(row.targetSize, ROW_DATA_OVERWRITE_SIZE);
                    });
                    stream.on('end', function () {
                      callback();
                    });
                  }
                }
              });
            }
          ],
          done
        );
      }

    };
  };

  for (let index = 0; index < testCases.length; index++) {
    const testCase = testCases[index];
    it(testCase.name, createItCallback());
  }
});

describe('PUT GET test with GCS_USE_DOWNSCOPED_CREDENTIAL select large query', function () {
  this.retries(3); // this test suit are considered as flaky test

  let connection;

  before(async () => {
    connection = testUtil.createConnection({
      gcsUseDownscopedCredential: true
    });
    await testUtil.connectAsync(connection);
  });

  after(async () => {
    await testUtil.destroyConnectionAsync(connection);
  });

  it('testSelectLargeQuery', function (done) {
    async.series(
      [
        function (callback) {
          const rowCount = 100000;
          // Check the row count is correct
          connection.execute({
            sqlText: `SELECT COUNT(*)
                      FROM (select seq4() from table (generator(rowcount => ${rowCount})))`,
            complete: function (err, stmt) {
              if (err) {
                callback(err);
              } else {
                const stream = stmt.streamRows();
                stream.on('error', function (err) {
                  callback(err);
                });
                stream.on('data', function (row) {
                  // Check the row count is correct
                  assert.strictEqual(row['COUNT(*)'], rowCount);
                });
                stream.on('end', function () {
                  callback();
                });
              }
            }
          });
        }
      ],
      done
    );
  });
});

describe('PUT GET test with GCS_USE_DOWNSCOPED_CREDENTIAL', function () {
  this.retries(3); // this test suit are considered as flaky test

  let connection;
  let tmpFile;
  const TEMP_TABLE_NAME = randomizeName('TEMP_TABLE');
  const createTable = `create or replace table ${TEMP_TABLE_NAME} (${COL1} STRING, ${COL2} STRING, ${COL3} STRING)`;
  const copyInto = `COPY INTO ${TEMP_TABLE_NAME}`;
  const removeFile = `REMOVE @${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME}`;
  const dropTable = `DROP TABLE IF EXISTS ${TEMP_TABLE_NAME}`;

  before(async () => {
    connection = testUtil.createConnection({
      gcsUseDownscopedCredential: true
    });
    await testUtil.connectAsync(connection);
    await testUtil.executeCmdAsync(connection, createTable);
  });

  after(async () => {
    testUtil.deleteFileSyncIgnoringErrors(tmpFile);

    await testUtil.executeCmdAsync(connection, removeFile);
    await testUtil.executeCmdAsync(connection, dropTable);
    await testUtil.destroyConnectionAsync(connection);
  });

  it('testUploadDownload', function (done) {

    // Create a temp file with specified file extension and write row data to temp file
    tmpFile = testUtil.createTempFile(os.tmpdir(), testUtil.createRandomFileName( { postfix: 'gz' } ), ROW_DATA);

    let putQuery = `PUT file://${tmpFile} @${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME}`;
    // Windows user contains a '~' in the path which causes an error
    if (process.platform === 'win32') {
      const fileName = path.basename(tmpFile);
      putQuery = `PUT file://${process.env.USERPROFILE}\\AppData\\Local\\Temp\\${fileName} @${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME}`;
    }

    // Create a tmp folder for downloaded files
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'get'));
    let fileSize;

    let getQuery = `GET @${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME} file://${tmpDir}`;
    // Windows user contains a '~' in the path which causes an error
    if (process.platform === 'win32') {
      const dirName = tmpDir.substring(tmpDir.lastIndexOf('\\') + 1);
      getQuery = `GET @${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME} file://${process.env.USERPROFILE}\\AppData\\Local\\Temp\\${dirName}`;
    }

    async.series(
      [
        function (callback) {
          // Upload file
          connection.execute({
            sqlText: putQuery,
            complete: function (err, stmt) {
              if (err) {
                callback(err);
              } else {
                const stream = stmt.streamRows();
                stream.on('error', function (err) {
                  callback(err);
                });
                stream.on('data', function (row) {
                  fileSize = row.targetSize;
                  // Check the file is correctly uploaded
                  assert.strictEqual(row['status'], UPLOADED);
                  // Check the target encoding is correct
                  assert.strictEqual(row['targetCompression'], 'GZIP');
                });
                stream.on('end', function () {
                  callback();
                });
              }
            }
          });
        },
        function (callback) {
          // Copy into temp table
          testUtil.executeCmd(connection, copyInto, callback);
        },
        function (callback) {
          // Check the contents are correct
          connection.execute({
            sqlText: `SELECT * FROM ${TEMP_TABLE_NAME}`,
            complete: function (err, stmt) {
              if (err) {
                callback(err);
              } else {
                const stream = stmt.streamRows();
                stream.on('error', function (err) {
                  callback(err);
                });
                stream.on('data', function (row) {
                  // Check the row data is correct
                  assert.strictEqual(row[COL1], COL1_DATA);
                  assert.strictEqual(row[COL2], COL2_DATA);
                  assert.strictEqual(row[COL3], COL3_DATA);
                });
                stream.on('end', function () {
                  callback();
                });
              }
            }
          });
        },
        function (callback) {
          // Check the row count is correct
          connection.execute({
            sqlText: `SELECT COUNT(*) FROM ${TEMP_TABLE_NAME}`,
            complete: function (err, stmt) {
              if (err) {
                callback(err);
              } else {
                const stream = stmt.streamRows();
                stream.on('error', function (err) {
                  callback(err);
                });
                stream.on('data', function (row) {
                  // Check the row count is correct
                  assert.strictEqual(row['COUNT(*)'], 4);
                });
                stream.on('end', function () {
                  callback();
                });
              }
            }
          });
        },
        function (callback) {
          // Run GET command
          connection.execute({
            sqlText: getQuery,
            complete: function (err, stmt) {
              if (err) {
                callback(err); 
              } else {
                const stream = stmt.streamRows();
                stream.on('error', function (err) {
                  callback(err);
                });
                stream.on('data', function (row) {
                  assert.strictEqual(row.status, DOWNLOADED);
                  assert.strictEqual(row.size, fileSize);
                  // Delete the downloaded file
                  fs.unlink(path.join(tmpDir, row.file), (err) => {
                    if (err) {
                      throw (err);
                    }
                    // Delete the temporary folder
                    fs.rmdir(tmpDir, (err) => {
                      if (err) {
                        throw (err);
                      }
                    });
                  });
                });
                stream.on('end', function () {
                  callback();
                });
              }
            }
          });
        }
      ],
      done
    );
  });
});

describe('PUT GET test with multiple files', function () {
  let connection;
  let tmpDir;
  const TEMP_TABLE_NAME = randomizeName('TEMP_TABLE');
  const stage = `@${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME}`;
  const removeFile = `REMOVE ${stage}`;
  let tmpFiles;

  before(async () => {
    connection = testUtil.createConnection({
      gcsUseDownscopedCredential: true,
    });
    await testUtil.connectAsync(connection);
    const createTable = `create or replace table ${TEMP_TABLE_NAME} (${COL1} STRING, ${COL2} STRING, ${COL3} STRING)`;
    await testUtil.executeCmdAsync(connection, createTable);
  });

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'get'));
    tmpFiles = [];
  });

  afterEach(async () => {
    tmpFiles.forEach(file => {
      testUtil.deleteFileSyncIgnoringErrors(file);
    });
    testUtil.deleteFolderSyncIgnoringErrors(tmpDir);

    await testUtil.executeCmdAsync(connection, removeFile);
    await testUtil.executeCmdAsync(connection, `truncate table if exists ${TEMP_TABLE_NAME}`);
  });

  after(async () => {
    await testUtil.dropTablesIgnoringErrorsAsync(connection, [TEMP_TABLE_NAME]);
    await testUtil.destroyConnectionAsync(connection);
  });

  it('testDownloadMultifiles', function (done) {
    // Create two temp file with specified file extension and write row data to temp file
    const tmpFile1 = testUtil.createTempFile(os.tmpdir(), testUtil.createRandomFileName( { postfix: 'gz' } ), ROW_DATA);
    const tmpFile2 = testUtil.createTempFile(os.tmpdir(), testUtil.createRandomFileName( { postfix: 'gz' } ), ROW_DATA);
    tmpFiles = [tmpFile1, tmpFile2];

    const tmpfilePath1 = getPlatformTmpPath(tmpFile1);
    const tmpfilePath2 = getPlatformTmpPath(tmpFile2);

    const putQuery1 = `PUT ${tmpfilePath1} ${stage}`;
    const putQuery2 = `PUT ${tmpfilePath2} ${stage}`;

    const results = {};

    const tmpdirPath = getPlatformTmpPath(tmpDir);
    const getQuery = `GET ${stage} ${tmpdirPath}`;

    const testResult = [];

    async.series(
      [
        function (callback) {
          executePutCmd(connection, putQuery1, callback, results);
        },
        function (callback) {
          executePutCmd(connection, putQuery2, callback, results);
        },
        function (callback) {
          // Run GET command
          connection.execute({
            sqlText: getQuery,
            streamResult: true,
            complete: function (err, stmt) {
              if (err) {
                callback(err);
              } else {
                const stream = stmt.streamRows();
                stream.on('error', function (err) {
                  callback(err);
                });
                stream.on('data', function (row) {
                  assert.strictEqual(row.status, DOWNLOADED);
                  assert.strictEqual(row.size, results.fileSize);

                  // Decompress the downloaded file
                  const compressedFile = path.join(tmpDir, row.file);
                  const decompressedFile = path.join(tmpDir, 'de-' + row.file);
                  const fileContents = fs.createReadStream(compressedFile);
                  const writeStream = fs.createWriteStream(decompressedFile);
                  const unzip = zlib.createGunzip();

                  fileContents.pipe(unzip).pipe(writeStream).on('finish', function () {
                    // Verify the data of the downloaded file
                    // this callback is called asynchronously so we gather results and in stream end we check if all files are correct
                    const data = fs.readFileSync(decompressedFile).toString();
                    try {
                      assert.strictEqual(data, ROW_DATA);
                      testResult.push(true);
                    } catch (e) {
                      testResult.push(e);
                    }
                  });
                });
                stream.on('end', function () {
                  expectArrayToBeFinallyFilledWithTrue(2, testResult, callback);
                });
              }
            }
          });
        },
      ],
      done
    );
  });

  it('testUploadMultifiles', function (done) {
    const count = 5;
    const results = {};
    const tmpdirPath = getPlatformTmpPath(tmpDir);
    const getQuery = `GET ${stage} ${tmpdirPath}`;
    const testId = crypto.randomUUID();
    // Create temp files with specified prefix
    tmpFiles = [];
    for (let i = 0; i < count; i++) {
      const tmpFile = testUtil.createTempFile(os.tmpdir(), testUtil.createRandomFileName( { prefix: `testUploadDownloadMultifiles-${testId}` } ), ROW_DATA);
      tmpFiles.push(tmpFile);
    }

    let putQuery = `PUT file://${os.tmpdir()}/testUploadDownloadMultifiles-${testId}* ${stage}`;
    // Windows user contains a '~' in the path which causes an error
    if (process.platform === 'win32') {
      putQuery = `PUT file://${process.env.USERPROFILE}\\AppData\\Local\\Temp\\testUploadDownloadMultifiles-${testId}* ${stage}`;
    }

    const testResult = [];

    async.series(
      [
        function (callback) {
          executePutCmd(connection, putQuery, callback, results);
        },
        function (callback) {
          // Run GET command
          connection.execute({
            sqlText: getQuery,
            streamResult: true,
            complete: function (err, stmt) {
              if (err) {
                callback(err);
              } else {
                const stream = stmt.streamRows();
                stream.on('error', function (err) {
                  callback(err);
                });
                stream.on('data', function (row) {
                  assert.strictEqual(row.status, DOWNLOADED);
                  assert.strictEqual(row.size, results.fileSize);

                  // Decompress the downloaded file
                  const compressedFile = path.join(tmpDir, row.file);
                  const decompressedFile = path.join(tmpDir, 'de-' + row.file);
                  const fileContents = fs.createReadStream(compressedFile);
                  const writeStream = fs.createWriteStream(decompressedFile);
                  const unzip = zlib.createGunzip();

                  fileContents.pipe(unzip).pipe(writeStream).on('finish', function () {
                    // Verify the data of the downloaded file
                    // this callback is called asynchronously so we gather results and in stream end we check if all files are correct
                    const data = fs.readFileSync(decompressedFile).toString();
                    try {
                      assert.strictEqual(data, ROW_DATA);
                      testResult.push(true);
                    } catch (e) {
                      testResult.push(e);
                    }
                  });
                });
                stream.on('end', function () {
                  expectArrayToBeFinallyFilledWithTrue(count, testResult, callback);
                });
              }
            }
          });
        },
      ],
      done
    );
  });

  /**
   * @param expectedResultSize `number` expected result size
   * @param testResult `any[]` array with gathered results
   * @param callback `(err|undefined) => void` done or async series callback function
   */
  function expectArrayToBeFinallyFilledWithTrue(expectedResultSize, testResult, callback){
    const expectedResult = new Array(expectedResultSize).fill(true);
    function checkResult() {
      if (testResult.length >= expectedResultSize) {
        try {
          assert.deepEqual(testResult, expectedResult);
          callback();
        } catch (e){
          callback(e);
        }
      } else {
        setTimeout(checkResult, 100);
      }
    }

    setTimeout(checkResult, 100);
  }
});

describe('PUT GET test without compress', function () {
  let connection;
  const TEMP_TABLE_NAME = randomizeName('TEMP_TABLE');
  const stage = `@${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME}`;
  const createTable = `create or replace table ${TEMP_TABLE_NAME} (${COL1} STRING, ${COL2} STRING, ${COL3} STRING)`;
  const removeFile = `REMOVE ${stage}`;
  const dropTable = `DROP TABLE IF EXISTS ${TEMP_TABLE_NAME}`;

  let tmpFile = null;
  let tmpDir = null;
  let tmpfilePath = '';
  let putQuery = '';
  let tmpdirPath = '';
  let getQuery = '';

  before(async () => {
    // Create a temp file without specified file extension and Write row data to temp file
    tmpFile = testUtil.createTempFile(os.tmpdir(), testUtil.createRandomFileName(), ROW_DATA);

    // Create a tmp folder for downloaded files
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'get'));
    tmpfilePath = getPlatformTmpPath(tmpFile);
    putQuery = `PUT ${tmpfilePath} ${stage} AUTO_COMPRESS=FALSE`;
    tmpdirPath = getPlatformTmpPath(tmpDir);
    getQuery = `GET ${stage} ${tmpdirPath}`;
    
    connection = testUtil.createConnection();
    await testUtil.connectAsync(connection);
    await testUtil.executeCmdAsync(connection, createTable);
  });

  after(async () => {
    testUtil.deleteFileSyncIgnoringErrors(tmpFile);
    testUtil.deleteFolderSyncIgnoringErrors(tmpDir);

    await testUtil.executeCmdAsync(connection, removeFile);
    await testUtil.executeCmdAsync(connection, dropTable);
    await testUtil.destroyConnectionAsync(connection);
  });

  it('testNoCompress', function (done) {
    async.series(
      [
        function (callback) {
          connection.execute({
            sqlText: putQuery,
            complete: function (err, stmt) {
              if (err) {
                callback(err);
              } else {
                const stream = stmt.streamRows();
                stream.on('error', function (err) {
                  callback(err);
                });
                stream.on('data', function (row) {
                  // Check the file is correctly uploaded
                  assert.strictEqual(row['status'], UPLOADED);
                  assert.strictEqual(row.targetSize, ROW_DATA_SIZE);
                });
                stream.on('end', function () {
                  callback();
                });
              }
            }
          });
        },
        function (callback) {
          connection.execute({
            sqlText: getQuery,
            complete: function (err, stmt) {
              if (err) {
                callback(err);
              } else {
                const stream = stmt.streamRows();
                stream.on('error', function (err) {
                  callback(err);
                });
                stream.on('data', function (row) {
                  assert.strictEqual(row['status'], DOWNLOADED);
                  // Verify if the file is not compressed.
                  const file = path.join(tmpDir, row.file);
                  const data = fs.readFileSync(file).toString();
                  assert.strictEqual(data, ROW_DATA);
                });
                stream.on('end', function () {
                  callback();
                });
              }
            }
          });
        }
      ],
      done
    );
  });
});

describe('PUT GET test with different size', function () {
  let connection;
  const TEMP_TABLE_NAME = randomizeName('TEMP_TABLE');
  const stage = `@${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME}`;
  const createTable = `create or replace table ${TEMP_TABLE_NAME} (${COL1} STRING, ${COL2} STRING, ${COL3} STRING)`;
  const removeFile = `REMOVE ${stage}`;
  const dropTable = `DROP TABLE IF EXISTS ${TEMP_TABLE_NAME}`;

  let zeroByteFile = null;
  let largeFile = null; 
  let tmpDir = null;
  let zeroByteFilePath = '';
  let largeFilePath = '';
  let tmpdirPath = '';
  let getQuery = '';

  before(async () => {
    // Create a temp file without specified file extension
    zeroByteFile = testUtil.createTempFile(os.tmpdir(), testUtil.createRandomFileName());
    largeFile = testUtil.createTempFile(os.tmpdir(), testUtil.createRandomFileName()); 
    // Create a tmp folder for downloaded files
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'get'));
    // Create a file of 100 MB
    const fh = fs.openSync(largeFile, 'w');
    fs.writeSync(fh, 'ok', Math.max(0, 100 * 1024 * 1024 - 2));
    fs.closeSync(fh);

    zeroByteFilePath = getPlatformTmpPath(zeroByteFile);
    largeFilePath = getPlatformTmpPath(largeFile);
    tmpdirPath = getPlatformTmpPath(tmpDir);
    getQuery = `GET ${stage} ${tmpdirPath}`;

    connection = testUtil.createConnection();
    await testUtil.connectAsync(connection);
    await testUtil.executeCmdAsync(connection, createTable);
  });

  afterEach(async () => {
    await testUtil.executeCmdAsync(connection, removeFile);
  });

  after(async () => {
    testUtil.deleteFileSyncIgnoringErrors(zeroByteFile);
    testUtil.deleteFileSyncIgnoringErrors(largeFile);
    testUtil.deleteFolderSyncIgnoringErrors(tmpDir);
    await testUtil.executeCmdAsync(connection, dropTable);
    await testUtil.destroyConnectionAsync(connection);
  });

  it('zero byte file', function (done) {
    async.series(
      [
        function (callback) {
          executePutWithFileSize(
            `PUT ${zeroByteFilePath} ${stage} AUTO_COMPRESS=FALSE`,
            0,
            callback);
        },
        function (callback) {
          executeGetWithFileSize(getQuery, 0, callback);
        }
      ],
      done
    );
  });

  it('large size file', function (done) {
    async.series(
      [
        function (callback) {
          executePutWithFileSize(
            `PUT ${largeFilePath} ${stage} AUTO_COMPRESS=FALSE`,
            100 * 1024 * 1024,
            callback);
        },
        function (callback) {
          executeGetWithFileSize(getQuery, 100 * 1024 * 1024, callback);
        }
      ],
      done
    );
  });

  function executePutWithFileSize(putQuery, fileSize, callback) {
    connection.execute({
      sqlText: putQuery,
      complete: function (err, stmt) {
        if (err) {
          callback(err);
        } else {
          const stream = stmt.streamRows();
          stream.on('error', function (err) {
            callback(err);
          });
          stream.on('data', function (row) {
            // Check the file is correctly uploaded
            assert.strictEqual(row['status'], UPLOADED);
            assert.strictEqual(row.targetSize, fileSize);
          });
          stream.on('end', function () {
            callback();
          });
        }
      }
    });
  }

  function executeGetWithFileSize(getQuery, fileSize, callback) {
    connection.execute({
      sqlText: getQuery,
      complete: function (err, stmt) {
        if (err) {
          callback(err);
        } else {
          const stream = stmt.streamRows();
          stream.on('error', function (err) {
            callback(err);
          });
          stream.on('data', function (row) {
            assert.strictEqual(row['status'], DOWNLOADED);
            // Verify the size of the file
            const file = path.join(tmpDir, row.file);
            const size = fs.statSync(file).size;
            assert.strictEqual(size, fileSize);
          });
          stream.on('end', function () {
            callback();
          });
        }
      }
    });
  }
});


describe('PUT GET test with relative path and current working directory', function () {
  let connection;
  const TEMP_TABLE_NAME = randomizeName('TEMP_TABLE');
  const stage = `@${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME}`;
  const createTable = `create or replace table ${TEMP_TABLE_NAME} (${COL1} STRING, ${COL2} STRING, ${COL3} STRING)`;
  const removeFile = `REMOVE ${stage}`;
  const dropTable = `DROP TABLE IF EXISTS ${TEMP_TABLE_NAME}`;

  let tmpFile = null; 
  let tmpDir = null;
  let tmpFileDir = '';
  let relativeTmpFilePath = '';
  let getQuery = '';

  before(async () => {
    // Create a temp file without specified file extension
    tmpFile = testUtil.createTempFile(os.tmpdir(), testUtil.createRandomFileName()); 
    // Obtain the directory path for this tmp file, which will be passed as cwd to execute command
    tmpFileDir = path.dirname(tmpFile);
    // Create a tmp folder for downloaded files
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'get'));
    // Create a file of 10 B
    const fh = fs.openSync(tmpFile, 'w');
    fs.writeSync(fh, 'ok', Math.max(0, 10 * 1024 - 2));
    fs.closeSync(fh);

    // This is the relative path used in the PUT query
    relativeTmpFilePath = getRelativePlatformTmpFilePath(tmpFile);
    // Note that the GET query uses a relative path as well
    getQuery = `GET ${stage} file://.`;

    connection = testUtil.createConnection();
    await testUtil.connectAsync(connection);
    await testUtil.executeCmdAsync(connection, createTable);
  });

  afterEach(async () => {
    await testUtil.executeCmdAsync(connection, removeFile);
  });

  after(async () => {
    testUtil.deleteFileSyncIgnoringErrors(tmpFile);
    testUtil.deleteFolderSyncIgnoringErrors(tmpDir);
    await testUtil.executeCmdAsync(connection, dropTable);
    await testUtil.destroyConnectionAsync(connection);
  });


  it('uses the provided context for current working directory when SQL text uses relative path', function (done) {
    async.series(
      [
        function (callback) {
          executePutWithCwd(
            `PUT ${relativeTmpFilePath} ${stage} AUTO_COMPRESS=FALSE`,
            10 * 1024,
            callback);
        },
        function (callback) {
          executeGetWithCwd(getQuery, 10 * 1024, callback);
        }
      ],
      done
    );
  });

  function executePutWithCwd(putQuery, fileSize, callback) {
    connection.execute({
      cwd: tmpFileDir,
      sqlText: putQuery,
      complete: function (err, stmt) {
        if (err) {
          callback(err);
        } else {
          const stream = stmt.streamRows();
          stream.on('error', function (err) {
            callback(err);
          });
          stream.on('data', function (row) {
            // Check the file is correctly uploaded
            assert.strictEqual(row['status'], UPLOADED);
            assert.strictEqual(row.targetSize, fileSize);
          });
          stream.on('end', function () {
            callback();
          });
        }
      }
    });
  }

  function executeGetWithCwd(getQuery, fileSize, callback) {
    connection.execute({
      cwd: tmpDir,
      sqlText: getQuery,
      complete: function (err, stmt) {
        if (err) {
          callback(err);
        } else {
          const stream = stmt.streamRows();
          stream.on('error', function (err) {
            callback(err);
          });
          stream.on('data', function (row) {
            assert.strictEqual(row['status'], DOWNLOADED);
            // Verify the size of the file
            const file = path.join(tmpDir, row.file);
            const size = fs.statSync(file).size;
            assert.strictEqual(size, fileSize);
          });
          stream.on('end', function () {
            callback();
          });
        }
      }
    });
  }
});


describe('PUT GET test with error', function () {
  let connection;
  const TEMP_TABLE_NAME = randomizeName('TEMP_TABLE');
  const stage = `@${DATABASE_NAME}.${SCHEMA_NAME}.%${TEMP_TABLE_NAME}`;
  const stageNotExist = `@${DATABASE_NAME}.${SCHEMA_NAME}.%NONEXISTTABLE`;
  const createTable = `create or replace table ${TEMP_TABLE_NAME} (${COL1} STRING, ${COL2} STRING, ${COL3} STRING)`;
  const removeFile = `REMOVE ${stage}`;
  const dropTable = `DROP TABLE IF EXISTS ${TEMP_TABLE_NAME}`;

  let tmpFile = null; 
  let tmpfilePath = null;

  before(async () => {
    // Create a temp file without specified file extension
    tmpFile = testUtil.createTempFile(os.tmpdir(), testUtil.createRandomFileName());
    tmpfilePath = getPlatformTmpPath(tmpFile);
    
    connection = testUtil.createConnection();
    await testUtil.connectAsync(connection);
    await testUtil.executeCmdAsync(connection, createTable);
  });

  after(async () => {
    testUtil.deleteFileSyncIgnoringErrors(tmpFile);

    await testUtil.executeCmdAsync(connection, removeFile);
    await testUtil.executeCmdAsync(connection, dropTable);
    await testUtil.destroyConnectionAsync(connection);
  });

  it('file not exist', function (done) {
    async.series(
      [
        function (callback) {
          verifyCompilationError(`PUT file_not_exist.txt ${stage}  OVERWRITE=true`, callback);
        }
      ],
      done
    );
  });
  
  it('compresssed file not exist', function (done) {
    async.series(
      [
        function (callback) {
          verifyCompilationError(`PUT file_not_exist.gzip ${stage}  OVERWRITE=true`, callback);
        }
      ],
      done
    );
  });
  
  it('stage not exist', function (done) {
    async.series(
      [
        function (callback) {
          verifyCompilationError(`PUT ${tmpfilePath} ${stageNotExist}`, callback);
        }
      ],
      done
    );
  });

  function verifyCompilationError(putQuery, callback) {
    connection.execute({
      sqlText: putQuery,
      complete: function (err) {
        if (err) {
          assert.strictEqual(err.data.type, 'COMPILATION');
          callback();
        } else {
          assert.ok(err, 'there should be an error');
        }
      }
    });
  }
});
