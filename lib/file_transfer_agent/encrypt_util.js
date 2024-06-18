/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const path = require('path');
const crypto = require('crypto');
const os = require('os');
const fs = require('fs');
const Logger = require('../logger');
const AES_BLOCK_SIZE = 128;
const blockSize = parseInt(AES_BLOCK_SIZE / 8);  // in bytes

const QUERY_STAGE_MASTER_KEY = 'queryStageMasterKey';
const BASE64 = 'base64';

// Material Descriptor
function MaterialDescriptor(smkId, queryId, keySize) {
  return {
    'smkId': smkId,
    'queryId': queryId,
    'keySize': keySize
  };
}

// Encryption Material
function EncryptionMetadata(key, iv, matDesc) {
  return {
    'key': key,
    'iv': iv,
    'matDesc': matDesc
  };
}

function aesCbc(keySizeInBytes) {
  return `aes-${keySizeInBytes * 8}-cbc`;
}

function aesEcb(keySizeInBytes) {
  return `aes-${keySizeInBytes * 8}-ecb`;
}

exports.EncryptionMetadata = EncryptionMetadata;

function TempFileGenerator() {

  this.fileSync = function (option = { dir: os.tmpdir(), prefix: '', postfix: '', extension: '' }) {
    const randomName = crypto.randomUUID();
    const fileName = `${option.prefix || ''}${randomName}${option.postfix || ''}${'.' + option.extension || ''}`;

    if (!this.checkDirInTemp(option.dir)) {
      option.dir = os.tmpdir();
    }

    const fullpath = path.join(option.dir, fileName);
    
    fs.writeFileSync(fullpath, '');
    const fileDescriptor = fs.openSync(fullpath);
    return { name: fullpath, fd: fileDescriptor };
  };
  
  this.file = function (option = { dir: os.tmpdir(), prefix: '', postfix: '', extension: '' }, callback) {
    try {
      const { name, fd } = this.fileSync(option);
      callback(null, name, fd);
    } catch (err) {
      callback(err);
    }
  };
  
  this.checkDirInTemp = function (directoryPath) {
    if (!directoryPath || directoryPath.length === 0) {
      return false;
    }
  
    if (directoryPath.includes(os.tmpdir())) {
      if (fs.existsSync(directoryPath)) {
        return true;
      } else {
        Logger.getInstance().warn(`no such file or directory, open ${directoryPath}`);
      }
    } else {
      Logger.getInstance().warn(`dir option must be relative to ${os.tmpdir()}, found ${directoryPath}`);
    }
    return false;
  };
}

/**
 * Creates an encryption utility object.
 *
 * @param {module} encrypt
 * @param {module} filestream
 * @param {module} temp
 * 
 * @returns {Object}
 * @constructor
 */
function EncryptUtil(encrypt, filestream, temp) {
  const crypto = typeof encrypt !== 'undefined' ? encrypt : require('crypto');
  const fs = typeof filestream !== 'undefined' ? filestream : require('fs');
  const tmp = typeof temp !== 'undefined' ? temp : new TempFileGenerator();

  /**
   * Generate a buffer with random bytes given a size.
   *
   * @param {Number} byteLength
   *
   * @returns {Buffer} of size byteLength
   */
  function getSecureRandom(byteLength) {
    return crypto.randomBytes(byteLength);
  }

  /**
  * Convert a material descriptor object's values to unicode.
  *
  * @param {Object} matDesc
  *
  * @returns {Object}
  */
  function matDescToUnicode(matDesc) {
    matDesc['smkId'] = matDesc['smkId'].toString();
    matDesc['keySize'] = matDesc['keySize'].toString();
    const newMatDesc = JSON.stringify(matDesc);
    return newMatDesc;
  }

  /**
  * Encrypt file stream using AES algorithm.
  *
  * @param {Object} encryptionMaterial
  * @param {String} fileStream
  * @param {String} tmpDir
  * @param {Number} chunkSize
  *
  * @returns {Object}
  */
  this.encryptFileStream = async function (encryptionMaterial, fileStream) {
    // Get decoded key from base64 encoded value
    const decodedKey = Buffer.from(encryptionMaterial[QUERY_STAGE_MASTER_KEY], BASE64);
    const keySize = decodedKey.length;

    // Get secure random bytes with block size
    const ivData = getSecureRandom(blockSize);
    const fileKey = getSecureRandom(keySize);

    // Create cipher with file key, AES CBC, and iv data
    let cipher = crypto.createCipheriv(aesCbc(keySize), fileKey, ivData);
    const encrypted = cipher.update(fileStream);
    const final = cipher.final();
    const encryptedData = Buffer.concat([encrypted, final]);

    // Create key cipher with decoded key and AES ECB
    cipher = crypto.createCipheriv(aesEcb(keySize), decodedKey, null);

    // Encrypt with file key
    const encKek = Buffer.concat([
      cipher.update(fileKey),
      cipher.final()
    ]);

    const matDesc = MaterialDescriptor(
      encryptionMaterial.smkId,
      encryptionMaterial.queryId,
      keySize * 8
    );

    const metadata = EncryptionMetadata(
      encKek.toString(BASE64),
      ivData.toString(BASE64),
      matDescToUnicode(matDesc)
    );
    return {
      encryptionMetadata: metadata,
      dataStream: encryptedData
    };
  };
  /**
  * Encrypt file using AES algorithm.
  *
  * @param {Object} encryptionMaterial
  * @param {String} inFileName
  * @param {String} tmpDir
  * @param {Number} chunkSize
  *
  * @returns {Object}
  */
  this.encryptFile = async function (encryptionMaterial, inFileName,
    tmpDir = null, chunkSize = blockSize * 4 * 1024) {
    // Get decoded key from base64 encoded value
    const decodedKey = Buffer.from(encryptionMaterial[QUERY_STAGE_MASTER_KEY], BASE64);
    const keySize = decodedKey.length;

    // Get secure random bytes with block size
    const ivData = getSecureRandom(blockSize);
    const fileKey = getSecureRandom(keySize);

    // Create cipher with file key, AES CBC, and iv data
    let cipher = crypto.createCipheriv(aesCbc(keySize), fileKey, ivData);

    // Create temp file
    const tmpobj = tmp.fileSync({ dir: tmpDir, prefix: path.basename(inFileName) + '#' });
    const tempOutputFileName = tmpobj.name;
    const tempFd = tmpobj.fd;

    await new Promise(function (resolve) {
      const infile = fs.createReadStream(inFileName, { highWaterMark: chunkSize });
      const outfile = fs.createWriteStream(tempOutputFileName);

      infile.on('data', function (chunk) {
        // Encrypt chunk using cipher
        const encrypted = cipher.update(chunk);
        // Write to temp file
        outfile.write(encrypted);
      });
      infile.on('close', function () {
        outfile.write(cipher.final());
        outfile.close(resolve);
      });
    });

    // Create key cipher with decoded key and AES ECB
    cipher = crypto.createCipheriv(aesEcb(keySize), decodedKey, null);

    // Encrypt with file key
    const encKek = Buffer.concat([
      cipher.update(fileKey),
      cipher.final()
    ]);

    const matDesc = MaterialDescriptor(
      encryptionMaterial.smkId,
      encryptionMaterial.queryId,
      keySize * 8
    );

    const metadata = EncryptionMetadata(
      encKek.toString(BASE64),
      ivData.toString(BASE64),
      matDescToUnicode(matDesc)
    );

    // Close temp file
    fs.closeSync(tempFd);

    return {
      encryptionMetadata: metadata,
      dataFile: tempOutputFileName
    };
  };

  /**
  * Decrypt file using AES algorithm.
  *
  * @param {Object} encryptionMaterial
  * @param {String} inFileName
  * @param {String} tmpDir
  * @param {Number} chunkSize
  *
  * @returns {String}
  */
  this.decryptFile = async function (metadata, encryptionMaterial, inFileName,
    tmpDir = null, chunkSize = blockSize * 4 * 1024) {
    // Get key and iv from metadata
    const keyBase64 = metadata.key;
    const ivBase64 = metadata.iv;

    // Get decoded key from base64 encoded value
    const decodedKey = Buffer.from(encryptionMaterial[QUERY_STAGE_MASTER_KEY], BASE64);
    const keySize = decodedKey.length;

    // Get key bytes and iv bytes from base64 encoded value
    const keyBytes = new Buffer.from(keyBase64, BASE64);
    const ivBytes = new Buffer.from(ivBase64, BASE64);

    // Create temp file
    let tempOutputFileName;
    let tempFd;
    await new Promise((resolve, reject) => {
      tmp.file({ dir: tmpDir, prefix: path.basename(inFileName) + '#' }, (err, path, fd) => {
        if (err) {
          reject(err);
        }
        tempOutputFileName = path;
        tempFd = fd;
        resolve();
      });
    });

    // Create key decipher with decoded key and AES ECB
    let decipher = crypto.createDecipheriv(aesEcb(keySize), decodedKey, null);
    const fileKey = Buffer.concat([
      decipher.update(keyBytes),
      decipher.final()
    ]);

    // Create decipher with file key, iv bytes, and AES CBC
    decipher = crypto.createDecipheriv(aesCbc(keySize), fileKey, ivBytes);

    await new Promise(function (resolve) {
      const infile = fs.createReadStream(inFileName, { highWaterMark: chunkSize });
      const outfile = fs.createWriteStream(tempOutputFileName);

      infile.on('data', function (chunk) {
        // Dncrypt chunk using decipher
        const decrypted = decipher.update(chunk);
        // Write to temp file
        outfile.write(decrypted);
      });
      infile.on('close', function () {
        outfile.write(decipher.final());
        outfile.close(resolve);
      });
    });

    // Close temp file
    await new Promise((resolve, reject) => {
      fs.close(tempFd, (err) => {
        if (err) {
          reject(err); 
        }
        resolve();
      });
    });

    return tempOutputFileName;
  };
}

exports.EncryptUtil = EncryptUtil;
