/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

const EncryptionMetadata = require('./encrypt_util').EncryptionMetadata;
const FileHeader = require('./file_util').FileHeader;

const GCS_METADATA_PREFIX = 'x-goog-meta-';
const GCS_METADATA_SFC_DIGEST = GCS_METADATA_PREFIX + 'sfc-digest';
const GCS_METADATA_MATDESC_KEY = GCS_METADATA_PREFIX + 'matdesc';
const GCS_METADATA_ENCRYPTIONDATAPROP = GCS_METADATA_PREFIX + 'encryptiondata';
const GCS_FILE_HEADER_DIGEST = 'gcs-file-header-digest';
const GCS_FILE_HEADER_CONTENT_LENGTH = 'gcs-file-header-content-length';
const GCS_FILE_HEADER_ENCRYPTION_METADATA = 'gcs-file-header-encryption-metadata';
const CONTENT_CHUNK_SIZE = 10 * 1024;

const HTTP_HEADER_CONTENT_ENCODING = 'Content-Encoding';
const HTTP_HEADER_ACCEPT_ENCODING = 'Accept-Encoding';
const resultStatus = require('./file_util').resultStatus;

// GCS Location
function GCSLocation(bucketName, path)
{
  return {
    "bucketName": bucketName,
    "path": path
  }
}

/**
 * Creates an GCS utility object.
 *
 * @param {module} httpclient
 * @param {module} filestream
 *
 * @returns {Object}
 * @constructor
 */
function gcs_util(httpclient, filestream)
{
  const axios = typeof httpclient !== "undefined" ? httpclient : require('axios');
  const fs = typeof filestream !== "undefined" ? filestream : require('fs');

  /**
  * Retrieve the GCS token from the stage info metadata.
  *
  * @param {Object} stageInfo
  *
  * @returns {String}
  */
  this.createClient = function (stageInfo)
  {
    var stageCredentials = stageInfo['creds'];
    var gcsToken = stageCredentials['GCS_ACCESS_TOKEN'];

    var client;
    if (gcsToken)
    {
      client = gcsToken
    }
    else
    {
      client = null;
    }

    return client;
  }

  /**
  * Extract the bucket name and path from the metadata's stage location.
  *
  * @param {String} stageLocation
  *
  * @returns {Object}
  */
  this.extractBucketNameAndPath = function (stageLocation)
  {
    var containerName = stageLocation;
    var path = '';

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

    return GCSLocation(containerName, path);
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
    if (meta['resultStatus'] == resultStatus.UPLOADED ||
      meta['resultStatus'] == resultStatus.DOWNLOADED)
    {
      return FileHeader(
        meta[GCS_FILE_HEADER_DIGEST],
        meta[GCS_FILE_HEADER_CONTENT_LENGTH],
        meta[GCS_FILE_HEADER_ENCRYPTION_METADATA]
      );
    }
    else
    {
      if (meta['presignedUrl'])
      {
        await axios.get(meta['presignedUrl'])
          .catch(err =>
          {
            if ([401, 403, 404].includes(err.response.status))
            {
              meta['resultStatus'] = resultStatus.NOT_FOUND_FILE;
            }
          });
      }
      else
      {
        var url = this.generateFileURL(meta['stageInfo']['location'], lstrip(filename, '/'));
        var accessToken = meta['client'];
        var gcsHeaders = { 'Authorization': `Bearer ${accessToken}` };
        var encryptionMetadata;

        try
        {
          var response = await axios.head(url, { headers: gcsHeaders });
          var digest = response.headers[GCS_METADATA_SFC_DIGEST];
          var contentLength = response.headers['content-length'];

          if (response.headers[GCS_METADATA_ENCRYPTIONDATAPROP])
          {
            var encryptionData = JSON.parse(response.headers[GCS_METADATA_ENCRYPTIONDATAPROP]);
            if (encryptionData)
            {
              encryptionMetadata = EncryptionMetadata(
                encryptionData['WrappedContentKey']['EncryptedKey'],
                encryptionData['ContentEncryptionIV'],
                response.headers[GCS_METADATA_MATDESC_KEY] ? response.headers[GCS_METADATA_MATDESC_KEY] : null
              );
            }
          }

          meta['resultStatus'] = resultStatus.UPLOADED;
          return FileHeader(
            digest,
            contentLength,
            encryptionMetadata
          );
        }
        catch (err)
        {
          if ([403, 408, 429, 500, 503].includes(err.response.status))
          {
            meta['lastError'] = err;
            meta['resultStatus'] = resultStatus.NEED_RETRY;
            return;
          }
          if (err.response.status == 404)
          {
            meta['resultStatus'] = resultStatus.NOT_FOUND_FILE;
          }
          else if (err.response.status == 401)
          {
            meta['lastError'] = err;
            meta['resultStatus'] = resultStatus.RENEW_TOKEN;
          }
          else
          {
            meta['lastError'] = err;
            meta['resultStatus'] = resultStatus.ERROR;
            throw err;
          }
        }
      }
    }
    return FileHeader(null, null, null);
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
    var uploadURL = meta['presignedUrl'];
    var accessToken = null;

    if (!uploadURL)
    {
      var tempFilename = meta['dstFileName'].substring(meta['dstFileName'].indexOf('/') + 1, meta['dstFileName'].length);

      uploadUrl = this.generateFileURL(meta['stageInfo']['location'], tempFilename);
      accessToken = meta['client'];
    }
    var contentEncoding = "";

    if (meta['dstCompressionType'])
    {
      contentEncoding = meta['dstCompressionType']['name'];
      contentEncoding = contentEncoding.toLowerCase();
    }

    // We set the contentEncoding to blank for the following file types
    if (['gzip', 'bzip2', 'brotli', 'deflate', 'raw_deflate', 'zstd'].includes(contentEncoding))
    {
      contentEncoding = "";
    }

    var gcsHeaders = {
      [HTTP_HEADER_CONTENT_ENCODING]: contentEncoding,
      [GCS_METADATA_SFC_DIGEST]: meta['SHA256_DIGEST'],
    }
    if (accessToken)
    {
      gcsHeaders['Authorization'] = `Bearer ${accessToken}`;
    }

    if (encryptionMetadata)
    {
      gcsHeaders[GCS_METADATA_ENCRYPTIONDATAPROP] =
        JSON.stringify({
          'EncryptionMode': 'FullBlob',
          'WrappedContentKey': {
            'KeyId': 'symmKey1',
            'EncryptedKey': encryptionMetadata.key,
            'Algorithm': 'AES_CBC_256'
          },
          'EncryptionAgent': {
            'Protocol': '1.0',
            'EncryptionAlgorithm': 'AES_CBC_256',
          },
          'ContentEncryptionIV': encryptionMetadata.iv,
          'KeyWrappingMetadata': {
            'EncryptionLibrary': 'Java 5.3.0'
          }
        });
      gcsHeaders[GCS_METADATA_MATDESC_KEY] = encryptionMetadata.matDesc;
    }

    var fileStream = fs.readFileSync(dataFile);

    try
    {
      // Set maxBodyLength to allow large file uploading
      await axios.put(uploadURL, fileStream, { maxBodyLength: Infinity, headers: gcsHeaders });
    }
    catch (err)
    {
      if ([403, 408, 429, 500, 503].includes(err['code']))
      {
        meta['lastError'] = err;
        meta['resultStatus'] = resultStatus.NEED_RETRY;
      }
      else if (!accessToken && err['code'] == 400 &&
        (!meta['lastError'] || meta['lastError']['code'] != 400))
      {
        // Only attempt to renew urls if this isn't the second time this happens
        meta['lastError'] = err;
        meta['resultStatus'] = resultStatus.RENEW_PRESIGNED_URL;
      }
      else if (accessToken && err['code'] == 401)
      {
        meta['lastError'] = err;
        meta['resultStatus'] = resultStatus.RENEW_TOKEN;
      }
      return;
    }

    meta['dstFileSize'] = meta['uploadSize'];
    meta['resultStatus'] = resultStatus.UPLOADED;

    meta[GCS_FILE_HEADER_DIGEST] = gcsHeaders[GCS_METADATA_SFC_DIGEST];
    meta[GCS_FILE_HEADER_CONTENT_LENGTH] = meta['uploadSize'];
    meta[GCS_FILE_HEADER_ENCRYPTION_METADATA] = gcsHeaders[GCS_METADATA_ENCRYPTIONDATAPROP];
  }


  /**
   * Download the file.
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
    var downloadUrl = meta['presignedUrl'];
    var accessToken = null;
    var gcsHeaders = {};

    if (!downloadUrl)
    {
      downloadUrl = this.generateFileURL(
        meta.stageInfo["location"], lstrip(meta['srcFileName'], "/")
      )
      accessToken = meta['client'];
      gcsHeaders = { 'Authorization': `Bearer ${accessToken}` };
    }

    var response;
    try
    {
      await axios({
        method: 'get',
        url: downloadUrl,
        headers: gcsHeaders,
        responseType: 'stream'
      }).then(async (res) =>
      {
        response = res;
        await new Promise((resolve, reject) =>
        {
          const writer = fs.createWriteStream(fullDstPath);
          response.data.pipe(writer);
          writer.on('error', err =>
          {
            writer.close();
            reject(err);
          });
          writer.on('close', () =>
          {
            resolve();
          });
        });
      });
    }
    catch (err)
    {
      if (err['code'] == EXPIRED_TOKEN)
      {
        meta['resultStatus'] = resultStatus.RENEW_TOKEN;
      }
      else
      {
        meta['lastError'] = err;
        if (err['code'] == ERRORNO_WSAECONNABORTED)
        {
          meta['resultStatus'] = resultStatus.NEED_RETRY_WITH_LOWER_CONCURRENCY;
        }
        else
        {
          meta['resultStatus'] = resultStatus.NEED_RETRY;
        }
      }
      return;
    }

    var encryptionData;
    if (response.headers[GCS_METADATA_ENCRYPTIONDATAPROP])
    {
      encryptionData = JSON.parse(response.headers[GCS_METADATA_ENCRYPTIONDATAPROP]);
    }

    var encryptionMetadata;
    if (encryptionData)
    {
      encryptionMetadata = EncryptionMetadata(
        encryptionData["WrappedContentKey"]["EncryptedKey"],
        encryptionData["ContentEncryptionIV"],
        response.headers[GCS_METADATA_MATDESC_KEY]
      );
    }
    var fileInfo = fs.statSync(fullDstPath);
    meta['srcFileSize'] = fileInfo.size;

    meta['resultStatus'] = resultStatus.DOWNLOADED;

    meta[GCS_FILE_HEADER_DIGEST] = response.headers[GCS_METADATA_SFC_DIGEST];
    meta[GCS_FILE_HEADER_CONTENT_LENGTH] = response.headers['content-length'];
    meta[GCS_FILE_HEADER_ENCRYPTION_METADATA] = encryptionMetadata;
  }

  /**
  * Generate file URL based on bucket.
  *
  * @param {String} stageLocation
  * @param {String} filename
  *
  * @returns {String}
  */
  this.generateFileURL = function (stageLocation, filename)
  {
    var gcsLocation = this.extractBucketNameAndPath(stageLocation);
    var fullFilePath = `${gcsLocation.path}${filename}`;
    var link = 'https://storage.googleapis.com/' + gcsLocation.bucketName + '/' + fullFilePath;
    return link;
  }

/**
* Left strip the specified character from a string.
*
* @param {String} str
* @param {Character} remove
*
* @returns {String}
*/
  function lstrip(str, remove)
  {
    while (str.length > 0 && remove.indexOf(str.charAt(0)) != -1)
    {
      str = str.substr(1);
    }
    return str;
  }
}

module.exports = gcs_util;
