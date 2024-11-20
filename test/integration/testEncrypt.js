const assert = require('assert');
const path = require('path');
const os = require('os');
const fs = require('fs');
const SnowflakeEncryptionUtil = require('../../lib/file_transfer_agent/encrypt_util').EncryptUtil;

describe('Test Encryption/Decryption', function () {
  let encryptUtil;

  before(function () {
    encryptUtil = new SnowflakeEncryptionUtil();
  });

  it('GCM - Encrypt and decrypt raw data', function () {
    const data = 'abc';
    const iv = Buffer.from('ab1234567890');
    const key = Buffer.from('1234567890abcdef');

    const encryptedData = encryptUtil.encryptGCM(data, key, iv, null);
    assert.strictEqual(encryptedData.toString('base64'), 'iG+lT4o27hkzj3kblYRzQikLVQ==');

    const decryptedData = encryptUtil.decryptGCM(encryptedData, key, iv, null);
    assert.strictEqual(decryptedData.toString('utf-8'), data);
  });

  it('GCM - Encrypt and decrypt file', async function () {
    await encryptAndDecryptFile('gcm', async function (encryptionMaterial, inputFilePath) {
      const output = await encryptUtil.encryptFileGCM(encryptionMaterial, inputFilePath, os.tmpdir());
      return await encryptUtil.decryptFileGCM(output.encryptionMetadata, encryptionMaterial, output.dataFile, os.tmpdir());
    });
  });

  it('CBC - Encrypt and decrypt file', async function () {
    await encryptAndDecryptFile('cbc', async function (encryptionMaterial, inputFilePath) {
      const output = await encryptUtil.encryptFileCBC(encryptionMaterial, inputFilePath, os.tmpdir());
      return await encryptUtil.decryptFileCBC(output.encryptionMetadata, encryptionMaterial, output.dataFile, os.tmpdir());
    });
  });
  
  async function encryptAndDecryptFile(encryptionTypeName, encryptAndDecrypt) {
    const data = 'abc';
    const inputFilePath = path.join(os.tmpdir(), `${encryptionTypeName}_file_encryption_test`);
    await new Promise((resolve, reject) => {
      fs.writeFile(inputFilePath, data, err => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });

    const encryptionMaterial = {
      'queryStageMasterKey': 'YWJjZGVmMTIzNDU2Nzg5MA==',
      'queryId': 'unused',
      'smkId': '123'
    };
    const decryptedFilePath = await encryptAndDecrypt(encryptionMaterial, inputFilePath, os.tmpdir());
    const decryptedContent = await new Promise((resolve, reject) => {
      fs.readFile(decryptedFilePath, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
    assert.strictEqual(decryptedContent.toString('utf-8'), data);
  }
});