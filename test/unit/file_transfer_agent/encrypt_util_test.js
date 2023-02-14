/*
 * Copyright (c) 2021 Snowflake Computing Inc. All rights reserved.
 */

var assert = require('assert');
var mock = require('mock-require');
var SnowflakeEncryptionUtil = require('./../../../lib/file_transfer_agent/encrypt_util').encrypt_util;

describe('Encryption util', function ()
{
  var encryptionMaterial;
  var mockData = 'mockData';
  var mockFileName = 'mockFileName';
  var mockRandomBytes = 'mockRandomBytes';
  var mockTmpDir = 'mockTmpDir';
  var mockTmpName = 'mockTmpName';

  var EncryptionUtil;
  var encrypt;
  var filestream;
  var temp;

  this.beforeEach(function ()
  {
    encryptionMaterial = {
      queryStageMasterKey: 'ztke8tIdVt1zmlQIZm0BMA==',
      queryId: '123873c7-3a66-40c4-ab89-e3722fbccce1',
      smkId: 3112
    };

    mock('encrypt', {
      randomBytes: function (options)
      {
        return Buffer.from(mockRandomBytes);
      },
      createCipheriv: function (AES_CBC, fileKey, ivData)
      {
        function createCipheriv()
        {
          this.update = function (data)
          {
            function update(data)
            {
              return Buffer.from(mockData.substring(0, 4));
            }
            return new update(data);
          }
          this.final = function ()
          {
            function final()
            {
              return Buffer.from(mockData.substring(4));
            }
            return new final;
          }
        }
        return new createCipheriv;
      }
    });
    mock('filestream', {
      createReadStream: function (inFileName, options)
      {
        function createReadStream()
        {
          this.on = function (event, callback)
          {
            callback();
            return;
          }
        }
        return new createReadStream;
      },
      createWriteStream: function (options)
      {
        function createWriteStream()
        {
          this.write = function (data)
          {
            return;
          }
          this.close = function (resolve)
          {
            resolve();
            return;
          }
        }
        return new createWriteStream;
      },
      closeSync: function (fd)
      {
        return;
      }
    });
    mock('temp', {
      fileSync: function (options)
      {
        return {
          name: mockTmpName,
          fd: 0
        }
      },
      openSync: function (options)
      {
        return;
      }
    });

    encrypt = require('encrypt');
    filestream = require('filestream');
    temp = require('temp');

    EncryptionUtil = new SnowflakeEncryptionUtil(encrypt, filestream, temp);
  });

  it('encrypt file', async function ()
  {
    var result = await EncryptionUtil.encryptFile(encryptionMaterial, mockFileName, mockTmpDir);

    var decodedKey = Buffer.from(encryptionMaterial['queryStageMasterKey'], 'base64');
    var keySize = decodedKey.length;

    var matDesc = {
      "smkId": encryptionMaterial.smkId,
      "queryId": encryptionMaterial.queryId,
      "keySize": keySize * 8
    }
    matDesc['smkId'] = matDesc['smkId'].toString();
    matDesc['keySize'] = matDesc['keySize'].toString();
    matDesc = JSON.stringify(matDesc);

    assert.strictEqual(result.encryptionMetadata.key, Buffer.from(mockData).toString('base64'));
    assert.strictEqual(result.encryptionMetadata.iv, Buffer.from(mockRandomBytes).toString('base64'));
    assert.strictEqual(result.encryptionMetadata.matDesc, matDesc);
  });
});
