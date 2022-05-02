///*
// * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
// */

const EncryptionMetadata = require('./encrypt_util').EncryptionMetadata;
const FileHeader = require('./file_util').FileHeader;
const expandTilde = require('expand-tilde');
const resultStatus = require('./file_util').resultStatus;

const EXPIRED_TOKEN = 'ExpiredToken';

// Azure Location
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
 * @param {module} azure
 * @param {module} filestream
 *
 * @returns {Object}
 * @constructor
 */
function azure_util(azure, filestream)
{
  const BlobServiceClient = typeof azure !== "undefined" ? azure : require("@azure/storage-blob").BlobServiceClient;
  const fs = typeof filestream !== "undefined" ? filestream : require('fs');

  /**
  * Create a blob service client using an Azure SAS token.
  *
  * @param {Object} stageInfo
  *
  * @returns {String}
  */
  this.createClient = function (stageInfo)
  {
    var stageCredentials = stageInfo['creds'];
    var sasToken = stageCredentials['AZURE_SAS_TOKEN'];

    var account = stageInfo['storageAccount'];

    var blobServiceClient = new BlobServiceClient(
      `https://${account}.blob.core.windows.net${sasToken}`
    );

    return blobServiceClient;
  }

  /**
  * Extract the container name and path from the metadata's stage location.
  *
  * @param {String} stageLocation
  *
  * @returns {Object}
  */
  this.extractContainerNameAndPath = function (stageLocation)
  {
    // expand '~' and '~user' expressions
    if (process.platform !== "win32")
    {
      stageLocation = expandTilde(stageLocation);
    }

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

  /**
  * Create file header based on file being uploaded or not.
  *
  * @param {Object} meta
  * @param {String} filename
  *
  * @returns {Object}
  */
  this.getFileHeader = async function (meta, filename)
  {
    var stageInfo = meta['stageInfo'];
    var client = this.createClient(stageInfo);
    var azureLocation = this.extractContainerNameAndPath(stageInfo['location']);

    var containerClient = client.getContainerClient(azureLocation.containerName);
    var blobClient = containerClient.getBlobClient(azureLocation.path + filename);

    var blobDetails;

    try
    {
      await blobClient.getProperties()
        .then(function (data)
        {
          blobDetails = data;
        })
    }
    catch (err)
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

    var encryptionMetadata = null;
    if (blobDetails.metadata['encryptiondata'])
    {
      var encryptionData = JSON.parse(blobDetails.metadata['encryptiondata']);
      encryptionMetadata = EncryptionMetadata(
        encryptionData['WrappedContentKey']['EncryptedKey'],
        encryptionData['ContentEncryptionIV'],
        blobDetails.metadata['matdesc']
      );
    }

    return FileHeader(
      blobDetails.metadata['sfcdigest'],
      blobDetails.contentLength,
      encryptionMetadata
    );
  }

  /**
  * Create the file metadata then upload the file.
  *
  * @param {String} dataFile
  * @param {Object} meta
  * @param {Object} encryptionMetadata
  * @param {Number} maxConcurrency
  *
  * @returns {null}
  */
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

    try
    {
      await blockBlobClient.upload(fileStream, fileStream.length, {
        metadata: azureMetadata,
        blobHTTPHeaders:
        {
          blobContentEncoding: 'UTF-8',
          blobContentType: 'application/octet-stream'
        }
      });
    }
    catch (err)
    {
      if (err['statusCode'] == 403 && detectAzureTokenExpireError(err))
      {
        meta['lastError'] = err;
        meta['resultStatus'] = resultStatus.RENEW_TOKEN;
        return;
      }
      else
      {
        meta['lastError'] = err;
        meta['resultStatus'] = resultStatus.NEED_RETRY;
      }
      return;
    }

    meta['dstFileSize'] = meta['uploadSize'];
    meta['resultStatus'] = resultStatus.UPLOADED;
  }

  /**
  * Download the file blob then write the file.
  *
  * @param {String} dataFile
  * @param {Object} meta
  * @param {Object} encryptionMetadata
  * @param {Number} maxConcurrency
  *
  * @returns {null}
  */
  this.nativeDownloadFile = async function (meta, fullDstPath, maxConcurrency)
  {
    var stageInfo = meta['stageInfo'];
    var client = this.createClient(stageInfo);
    var azureLocation = this.extractContainerNameAndPath(stageInfo['location']);
    var blobName = azureLocation.path + meta['srcFileName'];

    var containerClient = client.getContainerClient(azureLocation.containerName);
    var blockBlobClient = containerClient.getBlockBlobClient(blobName);

    try
    {
      var downloadBlockBlobResponse  = await blockBlobClient.download(0);
      var readableStream = downloadBlockBlobResponse.readableStreamBody;

      await new Promise((resolve, reject) =>
      {
        var writer = fs.createWriteStream(fullDstPath);
        readableStream.on("data", (data) =>
        {
          writer.write(data);
        });
        readableStream.on("end", () =>
        {
          writer.end();
          resolve();
        });
        readableStream.on("error", reject);
      });
    }
    catch (err)
    {
      if (err['statusCode'] == 403 && detectAzureTokenExpireError(err))
      {
        meta['lastError'] = err;
        meta['resultStatus'] = resultStatus.RENEW_TOKEN;
        return;
      }
      else
      {
        meta['lastError'] = err;
        meta['resultStatus'] = resultStatus.NEED_RETRY;
      }
      return;
    }

    meta['resultStatus'] = resultStatus.DOWNLOADED;
  }

  /**
  * Detect if the Azure token has expired.
  *
  * @param {Object} err
  *
  * @returns {Boolean}
  */
  function detectAzureTokenExpireError(err)
  {
    if (err['statusCode'] != 403)
    {
      return false;
    }
    var errstr = err.toString();
    return errstr.includes("Signature not valid in the specified time frame") ||
      errstr.includes("Server failed to authenticate the request.");
  }
}

module.exports = azure_util;
