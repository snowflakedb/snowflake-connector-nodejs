/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

var path = require('path');

const AES_CBC = 'aes-128-cbc';
const AES_ECB = 'aes-128-ecb';
const AES_BLOCK_SIZE = 128;
const blockSize = parseInt(AES_BLOCK_SIZE / 8);  // in bytes

const QUERY_STAGE_MASTER_KEY = 'queryStageMasterKey';
const BASE64 = 'base64';

// Material Descriptor
function MaterialDescriptor(smkId, queryId, keySize)
{
  return {
    "smkId": smkId,
    "queryId": queryId,
    "keySize": keySize
  }
}

// Encryption Material
function EncryptionMetadata(key, iv, matDesc)
{
  return {
    "key": key,
    "iv": iv,
    "matDesc": matDesc
  }
}

exports.EncryptionMetadata = EncryptionMetadata;

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
function encrypt_util(encrypt, filestream, temp)
{
  const crypto = typeof encrypt !== "undefined" ? encrypt : require('crypto');
  const fs = typeof filestream !== "undefined" ? filestream : require('fs');
  const tmp = typeof temp !== "undefined" ? temp : require('tmp');

  /**
   * Generate a buffer with random bytes given a size.
   *
   * @param {Number} byteLength
   *
   * @returns {Buffer} of size byteLength
   */
  function getSecureRandom(byteLength)
  {
    return crypto.randomBytes(byteLength);
  }

  /**
  * Convert a material descriptor object's values to unicode.
  *
  * @param {Object} matDesc
  *
  * @returns {Object}
  */
  function matDescToUnicode(matDesc)
  {
    matDesc['smkId'] = matDesc['smkId'].toString();
    matDesc['keySize'] = matDesc['keySize'].toString();
    var newMatDesc = JSON.stringify(matDesc);
    return newMatDesc;
  }

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
    tmpDir = null, chunkSize = blockSize * 4 * 1024)
  {
    // Get decoded key from base64 encoded value
    var decodedKey = Buffer.from(encryptionMaterial[QUERY_STAGE_MASTER_KEY], BASE64);
    var keySize = decodedKey.length;

    // Get secure random bytes with block size
    var ivData = getSecureRandom(blockSize);
    var fileKey = getSecureRandom(blockSize);

    // Create cipher with file key, AES CBC, and iv data
    var cipher = crypto.createCipheriv(AES_CBC, fileKey, ivData);

    // Create temp file
    var tmpobj = tmp.fileSync({ dir: tmpDir, prefix: path.basename(inFileName) + '#' });
    var tempOutputFileName = tmpobj.name;
    var tempFd = tmpobj.fd;

    await new Promise(function (resolve, reject)
    {
      var infile = fs.createReadStream(inFileName, { highWaterMark: chunkSize });
      var outfile = fs.createWriteStream(tempOutputFileName);

      infile.on('data', function (chunk)
      {
        // Encrypt chunk using cipher
        var encrypted = cipher.update(chunk);
        // Write to temp file
        outfile.write(encrypted);
      });
      infile.on('close', function ()
      {
        outfile.write(cipher.final());
        outfile.close(resolve);
      });
    });

    // Create key cipher with decoded key and AES ECB
    cipher = crypto.createCipheriv(AES_ECB, decodedKey, null);

    // Encrypt with file key
    var encKek = Buffer.concat([
      cipher.update(fileKey),
      cipher.final()
    ]);

    var matDesc = MaterialDescriptor(
      encryptionMaterial.smkId,
      encryptionMaterial.queryId,
      keySize * 8
    );

    var metadata = EncryptionMetadata(
      encKek.toString(BASE64),
      ivData.toString(BASE64),
      matDescToUnicode(matDesc)
    );

    // Close temp file
    fs.closeSync(tempFd);

    return {
      encryptionMetadata: metadata,
      dataFile: tempOutputFileName
    }
  }

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
    tmpDir = null, chunkSize = blockSize * 4 * 1024)
  {
    // Get key and iv from metadata
    var keyBase64 = metadata.key;
    var ivBase64 = metadata.iv;

    // Get decoded key from base64 encoded value
    var decodedKey = Buffer.from(encryptionMaterial[QUERY_STAGE_MASTER_KEY], BASE64);

    // Get key bytes and iv bytes from base64 encoded value
    var keyBytes = new Buffer.from(keyBase64, BASE64);
    var ivBytes = new Buffer.from(ivBase64, BASE64);

    // Create temp file
    var tempOutputFileName;
    var tempFd;
    await new Promise((resolve) =>
    {
       tmp.file({ dir: tmpDir, prefix: path.basename(inFileName) + '#' }, (err, path, fd) =>
       {
         if (err) reject(err);
         tempOutputFileName = path;
         tempFd = fd;
         resolve();
       });
    });

    // Create key decipher with decoded key and AES ECB
    var decipher = crypto.createDecipheriv(AES_ECB, decodedKey, null);
    var fileKey = Buffer.concat([
      decipher.update(keyBytes),
      decipher.final()
    ]);

    // Create decipher with file key, iv bytes, and AES CBC
    decipher = crypto.createDecipheriv(AES_CBC, fileKey, ivBytes);

    await new Promise(function (resolve, reject)
    {
      var infile = fs.createReadStream(inFileName, { highWaterMark: chunkSize });
      var outfile = fs.createWriteStream(tempOutputFileName);

      infile.on('data', function (chunk)
      {
        // Dncrypt chunk using decipher
        var decrypted = decipher.update(chunk);
        // Write to temp file
        outfile.write(decrypted);
      });
      infile.on('close', function ()
      {
        outfile.write(decipher.final());
        outfile.close(resolve);
      });
    });

    // Close temp file
    await new Promise((resolve) =>
    {
      fs.close(tempFd, (err) =>
      {
        if (err) reject(err);
        resolve();
      });
    });

    return tempOutputFileName;
  }
}

exports.encrypt_util = encrypt_util;
