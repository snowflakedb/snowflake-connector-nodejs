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
const { AES_ECB, AES_GCM, AES_CBC } = require('./encryption_types');

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
function EncryptionMetadata(key, dataIv, matDesc, keyIv, dataAad, keyAad) {
  return {
    'key': key,
    'iv': dataIv,
    'matDesc': matDesc,
    'keyIv': keyIv,
    'dataAad': dataAad,
    'keyAad': keyAad
  };
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

  function createEncryptionMetadata(encryptionMaterial, keySize, encKek, dataIv, keyIv = null, dataAuthTag = null, keyAuthTag = null) {
    const matDesc = MaterialDescriptor(
      encryptionMaterial.smkId,
      encryptionMaterial.queryId,
      keySize * 8
    );

    return new EncryptionMetadata(
      encKek.toString(BASE64),
      dataIv.toString(BASE64),
      matDescToUnicode(matDesc),
      keyIv,
      dataAuthTag,
      keyAuthTag
    );
  }

  /**
   * Encrypt content using AES algorithm.
   *
   * @param {Object} encryptionMaterial
   * @param content
   *
   * @returns {Object}
   */
  this.encryptFileStream = async function (encryptionMaterial, content) {
    return this.encryptWithCBC(encryptionMaterial, content);
  };

  this.encryptWithCBC = function (encryptionMaterial, data) {
    // Get decoded key from base64 encoded value
    const decodedKey = Buffer.from(encryptionMaterial[QUERY_STAGE_MASTER_KEY], BASE64);
    const keySize = decodedKey.length;

    // Get secure random bytes with block size
    const dataIv = getSecureRandom(AES_CBC.ivSize);
    const fileKey = getSecureRandom(keySize);

    // Create cipher with file key, AES CBC, and iv data
    const dataCipher = crypto.createCipheriv(AES_CBC.cipherName(keySize), fileKey, dataIv);
    const encryptedData = encryptData(dataCipher, data);

    // Create key cipher with decoded key and AES ECB
    const keyCipher = crypto.createCipheriv(AES_ECB.cipherName(keySize), decodedKey, null);

    // Encrypt with file key
    const encKek = Buffer.concat([
      keyCipher.update(fileKey),
      keyCipher.final()
    ]);

    return {
      encryptionMetadata: createEncryptionMetadata(encryptionMaterial, keySize, encKek, dataIv),
      dataStream: encryptedData
    };
  };

  this.encryptWithGCM = function (encryptionMaterial, data) {
    // Get decoded key from base64 encoded value
    const decodedKey = Buffer.from(encryptionMaterial[QUERY_STAGE_MASTER_KEY], BASE64);
    const keySize = decodedKey.length;

    // Get secure random bytes with block size
    const dataIv = getSecureRandom(AES_GCM.ivSize);
    const fileKey = getSecureRandom(keySize);

    // Create cipher with file key, AES CBC, and iv data
    const dataCipher = crypto.createCipheriv(AES_GCM.cipherName(keySize), fileKey, dataIv);
    const encryptedData = encryptData(dataCipher, data);

    // Create key cipher with decoded key and AES ECB
    const keyIv = getSecureRandom(AES_GCM.ivSize);
    const keyCipher = crypto.createCipheriv(AES_GCM.cipherName(keySize), decodedKey, keyIv);

    // Encrypt with file key
    const encKek = Buffer.concat([
      keyCipher.update(fileKey),
      keyCipher.final()
    ]);

    return {
      encryptionMetadata: createEncryptionMetadata(encryptionMaterial, keySize, encKek, dataIv),
      dataStream: encryptedData
    };
  };
  
  /**
   * Encrypt file using AES algorithm.
   *
   * @param {Object} encryptionMaterial
   * @param inputFilePath
   * @param {String} tmpDir
   * @param {Number} chunkSize
   *
   * @returns {Object}
   */
  this.encryptFile = async function (encryptionMaterial, inputFilePath,
    tmpDir = null, chunkSize = blockSize * 4 * 1024) {
    return await this.encryptFileWithCBC(encryptionMaterial, inputFilePath, tmpDir, chunkSize);
  };

  this.encryptFileWithCBC = async function (encryptionMaterial, inputFilePath,
    tmpDir = null, chunkSize = blockSize * 4 * 1024) {
    // Get decoded key from base64 encoded value
    const decodedKey = Buffer.from(encryptionMaterial[QUERY_STAGE_MASTER_KEY], BASE64);
    const keySize = decodedKey.length;

    const dataIv = getSecureRandom(AES_CBC.ivSize);
    const fileKey = getSecureRandom(keySize);
    const dataCipher = crypto.createCipheriv(AES_CBC.cipherName(keySize), fileKey, dataIv);

    // Perform data encryption
    const encryptedFile = await performFileStreamEncryption(dataCipher, tmpDir, inputFilePath, chunkSize);

    // encrypt key with AES ECB
    const keyCipher = crypto.createCipheriv(AES_ECB.cipherName(keySize), decodedKey, null);
    const encKek = Buffer.concat([
      keyCipher.update(fileKey),
      keyCipher.final()
    ]);

    return {
      encryptionMetadata: createEncryptionMetadata(encryptionMaterial, keySize, encKek, dataIv),
      dataFile: encryptedFile.name
    };
  };

  //TODO: Add proper usage when feature is ready (SNOW-940981)
  // eslint-disable-next-line no-unused-vars
  this.encryptFileWithGCM = async function (encryptionMaterial, inputFilePath,
    tmpDir = null, chunkSize = blockSize * 4 * 1024) {
    // Get decoded key from base64 encoded value
    const decodedKey = Buffer.from(encryptionMaterial[QUERY_STAGE_MASTER_KEY], BASE64);
    const keySize = decodedKey.length;

    // Get secure random bytes with block size
    const dataIv = getSecureRandom(AES_GCM.ivSize);
    const fileKey = getSecureRandom(keySize);
    const dataCipher = crypto.createCipheriv(AES_GCM.cipherName(keySize), fileKey, dataIv);

    // Perform data encryption
    const encryptedFile = await performFileStreamEncryption(dataCipher, tmpDir, inputFilePath, chunkSize);

    // Create key cipher with decoded key and AES GCM
    const keyIv = getSecureRandom(AES_GCM.ivSize);
    const keyCipher = crypto.createCipheriv(AES_GCM.cipherName(keySize), decodedKey, keyIv);

    // Encrypt with file key
    const encKek = Buffer.concat([
      keyCipher.update(fileKey),
      keyCipher.final()
    ]);
    
    return {
      encryptionMetadata: createEncryptionMetadata(encryptionMaterial, keySize, encKek, dataIv),
      dataFile: encryptedFile.name
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
    let decipher = crypto.createDecipheriv(AES_ECB.cipherName(keySize), decodedKey, null);
    const fileKey = Buffer.concat([
      decipher.update(keyBytes),
      decipher.final()
    ]);

    // Create decipher with file key, iv bytes, and AES CBC
    decipher = crypto.createDecipheriv(AES_CBC.cipherName(keySize), fileKey, ivBytes);

    await new Promise(function (resolve) {
      const infile = fs.createReadStream(inFileName, { highWaterMark: chunkSize });
      const outfile = fs.createWriteStream(tempOutputFileName);

      infile.on('data', function (chunk) {
        // Decrypt chunk using decipher
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

  function encryptData(cipher, content) {
    const encrypted = cipher.update(content);
    const final = cipher.final();
    return Buffer.concat([encrypted, final]);
  }


  async function performFileStreamEncryption(cipher, tmpDir, inputFilePath, chunkSize) {
    const outputFile = tmp.fileSync({ dir: tmpDir, prefix: path.basename(inputFilePath) + '#' });
    await new Promise(function (resolve) {
      const inputFile = fs.createReadStream(inputFilePath, { highWaterMark: chunkSize });
      const outputStream = fs.createWriteStream(outputFile.name);

      inputFile.on('data', function (chunk) {
        // Encrypt chunk using cipher
        const encrypted = cipher.update(chunk);
        // Write to temp file
        outputStream.write(encrypted);
      });
      inputFile.on('close', function () {
        outputStream.write(cipher.final());
        outputStream.close(resolve);
      });
    });
    fs.closeSync(outputFile.fd);
    return outputFile;
  }
}

exports.EncryptUtil = EncryptUtil;
