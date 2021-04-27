/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

const { BlobServiceClient } = require("@azure/storage-blob");
const EncryptionMetadata = require('./encrypt_util').EncryptionMetadata;
const FileHeader = require('./file_util').FileHeader;

const expandTilde = require('expand-tilde');
const fs = require('fs');

const EXPIRED_TOKEN = 'ExpiredToken';

const resultStatus = require('./file_util').resultStatus;

function AzureLocation(containerName, path)
{
  return {
    "containerName": containerName,
    "path": path
  }
}

/**
 * Creates an Azure utility object.
 *
 * @returns {Object}
 * @constructor
 */
function azure_util()
{
  this.createClient = function (stageInfo, useAccelerateEndpoint)
  {
    var stageCredentials = stageInfo['creds'];
    var sasToken = stageCredentials['AZURE_SAS_TOKEN'];

    var account = stageInfo['storageAccount'];

    var blobServiceClient = new BlobServiceClient(
      `https://${account}.blob.core.windows.net${sasToken}`
    );

    return blobServiceClient;
  }

  this.extractContainerNameAndPath = function (stageLocation)
  {
    // expand '~' and '~user' expressions
    stageLocation = expandTilde(stageLocation);

    var containerName = stageLocation;
    var path;

    // split stage location as bucket name and path
    if (stageLocation.includes('/'))
    {
      containerName = stageLocation.substring(0, stageLocation.indexOf('/'));

      path = stageLocation.substring(stageLocation.indexOf('/') + 1, stageLocation.length);
      if (path && !path.endsWith('/'))
      {
        path += '/';
      }
    }

    return AzureLocation(containerName, path);
  }

  this.getFileHeader = async function (meta, filename)
  {
    var stageInfo = meta['stageInfo'];
    var client = this.createClient(stageInfo);
    var azureLocation = this.extractContainerNameAndPath(stageInfo['location']);

    var containerClient = client.getContainerClient(azureLocation.containerName);
    var blobClient = containerClient.getBlobClient(azureLocation.path + filename);

    var blobDetails;
    var err;
    await blobClient.getProperties()
      .then(function (data)
      {
        console.log(data);
        blobDetails = data;
      })
      .catch(function (e)
      {
        err = e;
      });

    if (err)
    {
      if (err['code'] == EXPIRED_TOKEN)
      {
        meta['resultStatus'] = resultStatus.RENEW_TOKEN;
        return null;
      }
      else if (err['statusCode'] == '404')
      {
        meta['resultStatus'] = resultStatus.NOT_FOUND_FILE;
        return FileHeader(null, null, null);
      }
      else if (err['statusCode'] == '400')
      {
        meta['resultStatus'] = resultStatus.RENEW_TOKEN;
        return null;
      }
      else
      {
        meta['resultStatus'] = resultStatus.ERROR;
        return null;
      }
    }

    meta['resultStatus'] = resultStatus.UPLOADED;

    var encryptionData = JSON.parse(blobDetails.metadata['encryptiondata']);

    var encryptionMetadata = EncryptionMetadata(
      encryptionData['WrappedContentKey']['EncryptedKey'],
      encryptionData['ContentEncryptionIV'],
      blobDetails.metadata['matdesc']
    );   

    return FileHeader(
      blobDetails.metadata['sfcdigest'],
      blobDetails.contentLength,
      encryptionMetadata
    );
  }

  this.uploadFile = async function (dataFile, meta, encryptionMetadata, maxConcurrency)
  {
    var azureMetadata = {
      'sfcdigest': meta['SHA256_DIGEST']
    };

    if (encryptionMetadata)
    {
      azureMetadata['encryptiondata'] =
        JSON.stringify({
            'EncryptionMode': 'FullBlob',
            'WrappedContentKey': {
              'KeyId': 'symmKey1',
              'EncryptedKey': encryptionMetadata.key,
              'Algorithm': 'AES_CBC_256'
            },
            'EncryptionAgent': {
              'Protocol': '1.0',
              'EncryptionAlgorithm': 'AES_CBC_128',
            },
            'ContentEncryptionIV': encryptionMetadata.iv,
            'KeyWrappingMetadata': {
              'EncryptionLibrary': 'Java 5.3.0'
            }
          });
      azureMetadata['matdesc'] = encryptionMetadata.matDesc;
    }

    var stageInfo = meta['stageInfo'];
    var client = this.createClient(stageInfo);
    var azureLocation = this.extractContainerNameAndPath(stageInfo['location']);
    var blobName = azureLocation.path + meta['dstFileName'];

    var containerClient = client.getContainerClient(azureLocation.containerName);
    var blockBlobClient = containerClient.getBlockBlobClient(blobName);

    var fileStream = fs.readFileSync(dataFile);

    var uploadBlobResponse = await blockBlobClient.upload(fileStream, fileStream.length, { metadata: azureMetadata, blobHTTPHeaders: { blobContentEncoding: 'gzip' } });
    console.log(`Upload block blob ${blobName} successfully`, uploadBlobResponse.requestId);

    meta['dstFileSize'] = meta['uploadSize'];
    meta['resultStatus'] = resultStatus.UPLOADED;
  }
}

module.exports = azure_util;
