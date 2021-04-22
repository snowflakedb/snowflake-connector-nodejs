/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

var crypto = require('crypto');
var path = require('path');
var tmp = require('tmp');
var fs = require('fs');

const AES_CBC = 'aes-128-cbc';
const AES_ECB = 'aes-128-ecb';
const AES_BLOCK_SIZE = 128;
const blockSize = parseInt(AES_BLOCK_SIZE / 8);  // in bytes



// MaterialDescriptor
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
 * @returns {Object}
 * @constructor
 */
function encrypt_util ()
{
  function getSecureRandom(byteLength)
  {
    return crypto.randomBytes(byteLength);
  }

  this.encryptFile = async function (encryptionMaterial, inFileName,
    tmpDir = null, chunkSize = blockSize * 4 * 1024)
  {
    // 1. Get decoded key from base64 encoded value
    var decodedKey = Buffer.from(encryptionMaterial['queryStageMasterKey'], 'base64');
    // 2. Get decoded key length
    var keySize = decodedKey.length;

    // 3. Get secure random bytes with block size
    var ivData = getSecureRandom(blockSize);
    // 4. Get secure random bytes with key size
    var fileKey = getSecureRandom(blockSize);

    // 5. Create cipher with file key, AES CBC, and iv data
    var cipher = crypto.createCipheriv(AES_CBC, fileKey, ivData);

    // 6. Create temp dir and file
    var tmpobj = tmp.fileSync({ dir: tmpDir, prefix: path.basename(inFileName) + '#' });
    var tempOutputFileName = tmpobj.name;

    await new Promise(function (resolve, reject)
    {
      var infile = fs.createReadStream(inFileName, { highWaterMark: chunkSize });
      var outfile = fs.createWriteStream(tempOutputFileName);

      // 7. Read file
      infile.on('data', function (chunk)
      {
        // 8. Add padding - automatic padding by cipher

        // 9. Encrypt chunk using cipher
        var encrypted = cipher.update(chunk);
        // 10. Write to temp file
        outfile.write(encrypted);
      });
      infile.on('close', function ()
      {
        outfile.write(cipher.final());
        outfile.close();
        resolve();
      });
    });

    // 11. Create key cipher with decoded key and AES ECB
    cipher = crypto.createCipheriv(AES_ECB, decodedKey, null);

    // 12. Encrypt with file key and block size
    var encKek = Buffer.concat([
      cipher.update(fileKey),
      cipher.final()
    ]);

    // 13. Create MaterialDescriptor from encryption material
    var matDesc = MaterialDescriptor(
      encryptionMaterial.smkId,
      encryptionMaterial.queryId,
      keySize * 8
    );

    // 14. Create EncryptionMetadata from base64 encoded enc kek 
    // and base64 encoded iv data and stringified mat desc
    var metadata = EncryptionMetadata(
      encKek.toString('base64'),
      ivData.toString('base64'),
      JSON.stringify(matDesc)
    );

    return {
      encryptionMetadata: metadata,
      dataFile: tempOutputFileName
    }
  }
}

exports.encrypt_util = encrypt_util;
