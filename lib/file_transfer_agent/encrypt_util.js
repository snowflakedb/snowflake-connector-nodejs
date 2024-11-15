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
const DEFAULT_DATA_AAD = Buffer.from('default data aad');
const DEFAULT_KEY_AAD = Buffer.from('default key aad');

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
  const fs = typeof filestream !== 'undefined' ? filestream : require('node:fs/promises');
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

  function createEncryptionMetadata(encryptionMaterial, keySize, encryptedKek, dataIv, keyIv = null, dataAad = null, keyAad = null) {
    const matDesc = MaterialDescriptor(
      encryptionMaterial.smkId,
      encryptionMaterial.queryId,
      keySize * 8
    );

    return new EncryptionMetadata(
      encryptedKek.toString(BASE64),
      dataIv.toString(BASE64),
      matDescToUnicode(matDesc),
      keyIv,
      dataAad,
      keyAad
    );
  }

  /**
   * Encrypt content using AES-CBC algorithm.
   */
  this.encryptFileStream = async function (encryptionMaterial, content) {
    return this.encryptWithCBC(encryptionMaterial, content);
  };

  this.encryptWithCBC = function (encryptionMaterial, data) {
    const decodedKey = Buffer.from(encryptionMaterial[QUERY_STAGE_MASTER_KEY], BASE64);
    const keySize = decodedKey.length;

    const dataIv = getSecureRandom(AES_CBC.ivSize);
    const fileKey = getSecureRandom(keySize);

    const dataCipher = crypto.createCipheriv(AES_CBC.cipherName(keySize), fileKey, dataIv);
    const encryptedData = performCrypto(dataCipher, data);

    const keyCipher = crypto.createCipheriv(AES_ECB.cipherName(keySize), decodedKey, null);
    const encryptedKek = performCrypto(keyCipher, fileKey);

    return {
      encryptionMetadata: createEncryptionMetadata(encryptionMaterial, keySize, encryptedKek, dataIv),
      dataStream: encryptedData
    };
  };

  //TODO: Add proper usage when feature is ready (SNOW-940981)
  this.encryptWithGCM = function (encryptionMaterial, data) {
    const decodedKey = Buffer.from(encryptionMaterial[QUERY_STAGE_MASTER_KEY], BASE64);
    const keySize = decodedKey.length;

    const dataIv = getSecureRandom(AES_GCM.ivSize);
    const fileKey = getSecureRandom(keySize);
    const dataAad = DEFAULT_DATA_AAD;

    const dataCipher = crypto.createCipheriv(AES_GCM.cipherName(keySize), fileKey, dataIv);
    dataCipher.setAAD(dataAad);
    const encryptedData = performCrypto(dataCipher, data);

    const keyIv = getSecureRandom(AES_GCM.ivSize);
    const keyAad = DEFAULT_DATA_AAD;
    const keyCipher = crypto.createCipheriv(AES_GCM.cipherName(keySize), decodedKey, keyIv);
    keyCipher.setAAD(keyAad);
    const encryptedKek = performCrypto(keyCipher, fileKey);

    return {
      encryptionMetadata: createEncryptionMetadata(encryptionMaterial, keySize, encryptedKek, dataIv, keyIv, dataAad, keyAad),
      dataStream: encryptedData
    };
  };
  
  /**
   * Encrypt file using AES algorithm.
   */
  this.encryptFile = async function (encryptionMaterial, inputFilePath,
    tmpDir = null, chunkSize = blockSize * 4 * 1024) {
    return await this.encryptFileWithCBC(encryptionMaterial, inputFilePath, tmpDir, chunkSize);
  };

  this.encryptFileWithCBC = async function (encryptionMaterial, inputFilePath,
    tmpDir = null, chunkSize = blockSize * 4 * 1024) {
    const decodedKey = Buffer.from(encryptionMaterial[QUERY_STAGE_MASTER_KEY], BASE64);
    const keySize = decodedKey.length;

    const dataIv = getSecureRandom(AES_CBC.ivSize);
    const fileKey = getSecureRandom(keySize);
    const dataCipher = crypto.createCipheriv(AES_CBC.cipherName(keySize), fileKey, dataIv);
    const encryptedFile = await performFileStreamCrypto(dataCipher, tmpDir, inputFilePath, chunkSize);

    const keyCipher = crypto.createCipheriv(AES_ECB.cipherName(keySize), decodedKey, null);
    const encryptedKek = performCrypto(keyCipher, fileKey);

    return {
      encryptionMetadata: createEncryptionMetadata(encryptionMaterial, keySize, encryptedKek, dataIv),
      dataFile: encryptedFile.name
    };
  };

  //TODO: Add proper usage when feature is ready (SNOW-940981)
  this.encryptFileWithGCM = async function (encryptionMaterial, inputFilePath,
    tmpDir = null, chunkSize = blockSize * 4 * 1024) {
    const decodedKey = Buffer.from(encryptionMaterial[QUERY_STAGE_MASTER_KEY], BASE64);
    const keySize = decodedKey.length;

    const dataIv = getSecureRandom(AES_GCM.ivSize);
    const fileKey = getSecureRandom(keySize);
    const dataAad = DEFAULT_DATA_AAD;
    
    const dataCipher = crypto.createCipheriv(AES_GCM.cipherName(keySize), fileKey, dataIv);
    dataCipher.setAAD(dataAad);
    const encryptedFile = await performFileStreamCrypto(dataCipher, tmpDir, inputFilePath, chunkSize);

    const keyIv = getSecureRandom(AES_GCM.ivSize);
    const keyAad = DEFAULT_KEY_AAD;
    const keyCipher = crypto.createCipheriv(AES_GCM.cipherName(keySize), decodedKey, keyIv);
    keyCipher.setAAD(keyAad);
    const encryptedKek = performCrypto(keyCipher, fileKey);
    
    return {
      encryptionMetadata: createEncryptionMetadata(encryptionMaterial, keySize, encryptedKek, dataIv, keyIv, ),
      dataFile: encryptedFile.name
    };
  };

  /**
   * Decrypt file using AES algorithm.
   */
  this.decryptFile = async function (metadata, encryptionMaterial, inputFilePath,
    tmpDir = null, chunkSize = blockSize * 4 * 1024) {
    return await this.decryptFileWithCBC(metadata, encryptionMaterial, inputFilePath, tmpDir, chunkSize);
  };

  this.decryptFileWithCBC = async function (metadata, encryptionMaterial, inputFilePath,
    tmpDir = null, chunkSize = blockSize * 4 * 1024) {
    const keyBase64 = metadata.key;
    const ivBase64 = metadata.iv;

    const decodedKey = Buffer.from(encryptionMaterial[QUERY_STAGE_MASTER_KEY], BASE64);
    const keySize = decodedKey.length;

    const keyBytes = new Buffer.from(keyBase64, BASE64);
    const ivBytes = new Buffer.from(ivBase64, BASE64);
    const keyDecipher = crypto.createDecipheriv(AES_ECB.cipherName(keySize), decodedKey, null);
    const fileKey = performCrypto(keyDecipher, keyBytes);

    const dataDecipher = crypto.createDecipheriv(AES_CBC.cipherName(keySize), fileKey, ivBytes);
    return await performFileStreamCrypto(dataDecipher, tmpDir, inputFilePath, chunkSize);
  };

  //TODO: Add proper usage when feature is ready (SNOW-940981)
  this.decryptFileWithGCM = async function (metadata, encryptionMaterial, inputFilePath,
    tmpDir = null, chunkSize = blockSize * 4 * 1024) {
    const keyBase64 = metadata.key;
    const keyIvBase64 = metadata.keyIv;
    const dataIvBase64 = metadata.iv;

    const decodedKey = Buffer.from(encryptionMaterial[QUERY_STAGE_MASTER_KEY], BASE64);
    const keySize = decodedKey.length;

    const keyBytes = new Buffer.from(keyBase64, BASE64);
    const keyIvBytes = new Buffer.from(keyIvBase64, BASE64);
    const dataIvBytes = new Buffer.from(dataIvBase64, BASE64);

    const keyDecipher = crypto.createDecipheriv(AES_GCM.cipherName(keySize), decodedKey, keyIvBytes);
    const fileKey = performCrypto(keyDecipher, keyBytes);

    const dataDecipher = crypto.createDecipheriv(AES_GCM.cipherName(keySize), fileKey, dataIvBytes);
    return await performFileStreamCrypto(dataDecipher, tmpDir, inputFilePath, chunkSize);
  };
  
  function performCrypto(cipherOrDecipher, data) {
    const encrypted = cipherOrDecipher.update(data);
    const final = cipherOrDecipher.final();
    return Buffer.concat([encrypted, final]);
  }

  async function performFileStreamCrypto(cipherOrDecipher, tmpDir, inputFilePath, chunkSize) {
    let outputFilePath;
    await new Promise((resolve, reject) => {
      tmp.file({ dir: tmpDir, prefix: path.basename(inputFilePath) + '#' }, (err, path) => {
        if (err) {
          reject(err);
        }
        outputFilePath = path;
        resolve();
      });
    });
    const inputFile = await fs.open(inputFilePath);
    const outputFile = await fs.open(outputFilePath);

    await new Promise(function (resolve) {
      const inputWriteStream = inputFile.createReadStream({ highWaterMark: chunkSize });
      const outputWriteStream = outputFile.createWriteStream();

      inputWriteStream.on('data', function (chunk) {
        // Encrypt chunk using cipher
        const encrypted = cipherOrDecipher.update(chunk);
        // Write to temp file
        outputWriteStream.write(encrypted);
      });
      inputWriteStream.on('close', function () {
        outputWriteStream.write(cipherOrDecipher.final());
        outputWriteStream.close(resolve);
      });
    });

    await outputFile.close();
    return outputFilePath;
  }
}

exports.EncryptUtil = EncryptUtil;
