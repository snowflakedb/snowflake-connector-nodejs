/*
 * Copyright (c) 2021 Snowflake Computing Inc. All rights reserved.
 */

const assert = require('assert');
const mock = require('mock-require');
const SnowflakeEncryptionUtil = require('./../../../lib/file_transfer_agent/encrypt_util').EncryptUtil;

describe('Encryption util', function () {
  let encryptionMaterial;
  const mockData = 'mockData';
  const mockFileName = 'mockFileName';
  const mockRandomBytes = 'mockRandomBytes';
  const mockTmpDir = 'mockTmpDir';
  const mockTmpName = 'mockTmpName';

  let EncryptionUtil;
  let encrypt;
  let filestream;
  let temp;

  this.beforeEach(function () {
    encryptionMaterial = {
      queryStageMasterKey: 'ztke8tIdVt1zmlQIZm0BMA==',
      queryId: '123873c7-3a66-40c4-ab89-e3722fbccce1',
      smkId: 3112
    };

    mock('encrypt', {
      randomBytes: function () {
        return Buffer.from(mockRandomBytes);
      },
      createCipheriv: function () {
        function createCipheriv() {
          this.update = function (data) {
            function update() {
              return Buffer.from(mockData.substring(0, 4));
            }
            return new update(data);
          };
          this.final = function () {
            function final() {
              return Buffer.from(mockData.substring(4));
            }
            return new final;
          };
        }
        return new createCipheriv;
      }
    });
    mock('filestream', {
      createReadStream: function () {
        function createReadStream() {
          this.on = function (event, callback) {
            callback();
            return;
          };
        }
        return new createReadStream;
      },
      createWriteStream: function () {
        function createWriteStream() {
          this.write = function () {
            return;
          };
          this.close = function (resolve) {
            resolve();
            return;
          };
        }
        return new createWriteStream;
      },
      closeSync: function () {
        return;
      }
    });
    mock('temp', {
      fileSync: function () {
        return {
          name: mockTmpName,
          fd: 0
        };
      },
      openSync: function () {
        return;
      }
    });

    encrypt = require('encrypt');
    filestream = require('filestream');
    temp = require('temp');

    EncryptionUtil = new SnowflakeEncryptionUtil(encrypt, filestream, temp);
  });

  it('encrypt file', async function () {
    const result = await EncryptionUtil.encryptFile(encryptionMaterial, mockFileName, mockTmpDir);

    const decodedKey = Buffer.from(encryptionMaterial['queryStageMasterKey'], 'base64');
    const keySize = decodedKey.length;

    let matDesc = {
      'smkId': encryptionMaterial.smkId,
      'queryId': encryptionMaterial.queryId,
      'keySize': keySize * 8
    };
    matDesc['smkId'] = matDesc['smkId'].toString();
    matDesc['keySize'] = matDesc['keySize'].toString();
    matDesc = JSON.stringify(matDesc);

    assert.strictEqual(result.encryptionMetadata.key, Buffer.from(mockData).toString('base64'));
    assert.strictEqual(result.encryptionMetadata.iv, Buffer.from(mockRandomBytes).toString('base64'));
    assert.strictEqual(result.encryptionMetadata.matDesc, matDesc);
  });
});
