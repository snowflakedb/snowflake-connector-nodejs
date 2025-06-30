const assert = require('assert');
const mock = require('mock-require');
const SnowflakeEncryptionUtil = require('./../../../lib/file_transfer_agent/encrypt_util').EncryptUtil;

function readKeyLength(algorithmName) {
  switch (algorithmName) {
  case 'aes-128-cbc':
  case 'aes-128-ecb':
    return 128;
  case 'aes-256-cbc':
  case 'aes-256-ecb':
    return 256;
  default:
    throw new Error('Algorithm was not recognized!');
  }
}

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
      randomBytes: function (byteLength) {
        let randomString = '';
        while (mockRandomBytes.length < byteLength) {
          randomString = randomString + mockRandomBytes;
          byteLength = byteLength - mockRandomBytes.length;
        }
        randomString = randomString + mockRandomBytes.substring(0, byteLength);
        return Buffer.from(randomString);
      },
      createCipheriv: function (algorithm, key) {
        const expectedKeyLength = readKeyLength(algorithm);
        if (key.length * 8 !== expectedKeyLength) {
          throw new Error('Invalid key length!');
        }
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
      close: function (fd, callback) {
        callback(null);
      }
    });
    mock('temp', {
      file: function (object, callback) {
        callback(null, mockTmpName, 0);
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

  async function runEncryptionTest() {
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
    assert.strictEqual(result.encryptionMetadata.iv, encrypt.randomBytes(16).toString('base64'));
    assert.strictEqual(result.encryptionMetadata.matDesc, matDesc);
  }

  it('encrypt file with AES-128', async function () {
    await runEncryptionTest();
  });

  it('encrypt file with AES-256', async function () {
    encryptionMaterial.queryStageMasterKey = 'QUJDREFCQ0RBQkNEQUJDREFCQ0RBQkNEQUJDREFCQ0Q=';
    await runEncryptionTest();
  });
});
