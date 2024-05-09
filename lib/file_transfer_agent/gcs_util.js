/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const EncryptionMetadata = require('./encrypt_util').EncryptionMetadata;
const FileHeader = require('./file_util').FileHeader;
const { shouldPerformGCPBucket } = require('../util');

const GCS_METADATA_PREFIX = 'x-goog-meta-';
const SFC_DIGEST = 'sfc-digest';
const MATDESC_KEY = 'matdesc';
const ENCRYPTIONDATAPROP = 'encryptiondata';
const GCS_METADATA_SFC_DIGEST = GCS_METADATA_PREFIX + SFC_DIGEST;
const GCS_METADATA_MATDESC_KEY = GCS_METADATA_PREFIX + MATDESC_KEY;
const GCS_METADATA_ENCRYPTIONDATAPROP = GCS_METADATA_PREFIX + ENCRYPTIONDATAPROP;
const GCS_FILE_HEADER_DIGEST = 'gcs-file-header-digest';
const GCS_FILE_HEADER_CONTENT_LENGTH = 'gcs-file-header-content-length';
const GCS_FILE_HEADER_ENCRYPTION_METADATA = 'gcs-file-header-encryption-metadata';

const HTTP_HEADER_CONTENT_ENCODING = 'Content-Encoding';
const resultStatus = require('./file_util').resultStatus;

const { Storage } = require('@google-cloud/storage');

const EXPIRED_TOKEN = 'ExpiredToken';

const ERRORNO_WSAECONNABORTED = 10053;  // network connection was aborted

// GCS Location
function GCSLocation(bucketName, path) {
  return {
    'bucketName': bucketName,
    'path': path
  };
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
function GCSUtil(httpclient, filestream) {
  const axios = typeof httpclient !== 'undefined' ? httpclient : require('axios');
  const fs = typeof filestream !== 'undefined' ? filestream : require('fs');

  /**
  * Retrieve the GCS token from the stage info metadata.
  *
  * @param {Object} stageInfo
  *
  * @returns {String}
  */
  this.createClient = function (stageInfo) {
    const stageCredentials = stageInfo['creds'];
    const gcsToken = stageCredentials['GCS_ACCESS_TOKEN'];

    let client;
    if (gcsToken) {
      const interceptors = [];
      interceptors.push({
        request: (requestConfig) => {
          requestConfig.headers = requestConfig.headers || {};
          Object.assign(requestConfig.headers, { Authorization: `Bearer ${gcsToken}` });
          return requestConfig;
        }
      });

      const storage = new Storage({ interceptors_: interceptors });

      client = { gcsToken: gcsToken, gcsClient: storage };
    } else {
      client = null;
    }

    return client;
  };

  /**
  * Extract the bucket name and path from the metadata's stage location.
  *
  * @param {String} stageLocation
  *
  * @returns {Object}
  */
  this.extractBucketNameAndPath = function (stageLocation) {
    let containerName = stageLocation;
    let path = '';

    // split stage location as bucket name and path
    if (stageLocation.includes('/')) {
      containerName = stageLocation.substring(0, stageLocation.indexOf('/'));

      path = stageLocation.substring(stageLocation.indexOf('/') + 1, stageLocation.length);
      if (path && !path.endsWith('/')) {
        path += '/';
      }
    }

    return GCSLocation(containerName, path);
  };

  /**
  * Create file header based on file being uploaded or not.
  *
  * @param {Object} meta
  * @param {String} filename
  *
  * @returns {Object}
  */
  this.getFileHeader = async function (meta, filename) {
    if (meta['resultStatus'] === resultStatus.UPLOADED ||
      meta['resultStatus'] === resultStatus.DOWNLOADED) {
      return FileHeader(
        meta[GCS_FILE_HEADER_DIGEST],
        meta[GCS_FILE_HEADER_CONTENT_LENGTH],
        meta[GCS_FILE_HEADER_ENCRYPTION_METADATA]
      );
    } else {
      if (meta['presignedUrl']) {
        await axios.get(meta['presignedUrl'])
          .catch(err => {
            if ([401, 403, 404].includes(err.response.status)) {
              meta['resultStatus'] = resultStatus.NOT_FOUND_FILE;
            }
          });
      } else {
        const url = this.generateFileURL(meta['stageInfo']['location'], lstrip(filename, '/'));
        const accessToken = meta['client'].gcsToken;
        const gcsHeaders = { 'Authorization': `Bearer ${accessToken}` };
        let encryptionMetadata;
        let digest;
        let contentLength;
        let encryptionDataProp;
        let matDescKey;

        try {
          if (shouldPerformGCPBucket(accessToken)) {
            const gcsLocation = this.extractBucketNameAndPath(meta['stageInfo']['location']);

            const metadata = await meta['client'].gcsClient
              .bucket(gcsLocation.bucketName)
              .file(gcsLocation.path + filename)
              .getMetadata();

            digest = metadata[0].metadata[SFC_DIGEST];
            contentLength = metadata[0].size;
            encryptionDataProp = metadata[0].metadata[ENCRYPTIONDATAPROP];
            matDescKey = metadata[0].metadata[MATDESC_KEY];
          } else {
            const response = await axios.head(url, { headers: gcsHeaders });

            digest = response.headers[GCS_METADATA_SFC_DIGEST];
            contentLength = response.headers['content-length'];
            encryptionDataProp = response.headers[GCS_METADATA_ENCRYPTIONDATAPROP];
            matDescKey = response.headers[GCS_METADATA_MATDESC_KEY];
          }

          if (encryptionDataProp) {
            const encryptionData = JSON.parse(encryptionDataProp);
            if (encryptionData) {
              encryptionMetadata = EncryptionMetadata(
                encryptionData['WrappedContentKey']['EncryptedKey'],
                encryptionData['ContentEncryptionIV'],
                matDescKey ? matDescKey : null
              );
            }
          }

          meta['resultStatus'] = resultStatus.UPLOADED;

          return FileHeader(
            digest,
            contentLength,
            encryptionMetadata
          );
        } catch (err) {
          const errCode = !isNaN(err['code']) && !isNaN(parseInt(err['code'])) ? err['code'] : err.response.status;

          if ([403, 408, 429, 500, 503].includes(errCode)) {
            meta['lastError'] = err;
            meta['resultStatus'] = resultStatus.NEED_RETRY;
            return;
          }
          if (errCode === 404) {
            meta['resultStatus'] = resultStatus.NOT_FOUND_FILE;
          } else if (errCode === 401) {
            meta['lastError'] = err;
            meta['resultStatus'] = resultStatus.RENEW_TOKEN;
          } else {
            meta['lastError'] = err;
            meta['resultStatus'] = resultStatus.ERROR;
            throw err;
          }
        }
      }
    }
    return FileHeader(null, null, null);
  };

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
  this.uploadFile = async function (dataFile, meta, encryptionMetadata, maxConcurrency) {
    const fileStream = fs.readFileSync(dataFile);
    await this.uploadFileStream(fileStream, meta, encryptionMetadata, maxConcurrency);
  };

  /**
    * Create the file metadata then upload the file stream.
    *
    * @param {String} fileStream
    * @param {Object} meta
    * @param {Object} encryptionMetadata
    *
    * @returns {null}
    */
  this.uploadFileStream = async function (fileStream, meta, encryptionMetadata) {
    let uploadUrl = meta['presignedUrl'];
    let accessToken = null;

    if (!uploadUrl) {
      const tempFilename = meta['dstFileName'].substring(meta['dstFileName'].indexOf('/') + 1, meta['dstFileName'].length);

      uploadUrl = this.generateFileURL(meta['stageInfo']['location'], tempFilename);
      accessToken = meta['client'].gcsToken;
    }
    let contentEncoding = '';

    if (meta['dstCompressionType']) {
      contentEncoding = meta['dstCompressionType']['name'];
      contentEncoding = contentEncoding.toLowerCase();
    }

    // We set the contentEncoding to blank for the following file types
    if (['gzip', 'bzip2', 'brotli', 'deflate', 'raw_deflate', 'zstd'].includes(contentEncoding)) {
      contentEncoding = '';
    }

    const gcsHeaders = {
      [HTTP_HEADER_CONTENT_ENCODING]: contentEncoding,
      [GCS_METADATA_SFC_DIGEST]: meta['SHA256_DIGEST'],
    };

    if (accessToken) {
      gcsHeaders['Authorization'] = `Bearer ${accessToken}`;
    }

    if (encryptionMetadata) {
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

    try {
      if (shouldPerformGCPBucket(accessToken)) {
        const gcsLocation = this.extractBucketNameAndPath(meta['stageInfo']['location']);

        await meta['client'].gcsClient
          .bucket(gcsLocation.bucketName)
          .file(gcsLocation.path + meta['dstFileName'])
          .save(fileStream, {
            resumable: false,
            metadata: {
              metadata: {
                [ENCRYPTIONDATAPROP]: gcsHeaders[GCS_METADATA_ENCRYPTIONDATAPROP],
                [MATDESC_KEY]: gcsHeaders[GCS_METADATA_MATDESC_KEY],
                [SFC_DIGEST]: gcsHeaders[GCS_METADATA_SFC_DIGEST]
              }
            }
          });
      } else {
        // Set maxBodyLength to allow large file uploading
        await axios.put(uploadUrl, fileStream, { maxBodyLength: Infinity, headers: gcsHeaders });
      }
    } catch (err) {
      if ([403, 408, 429, 500, 503].includes(err['code'])) {
        meta['lastError'] = err;
        meta['resultStatus'] = resultStatus.NEED_RETRY;
      } else if (!accessToken && err['code'] === 400 &&
        (!meta['lastError'] || meta['lastError']['code'] !== 400)) {
        // Only attempt to renew urls if this isn't the second time this happens
        meta['lastError'] = err;
        meta['resultStatus'] = resultStatus.RENEW_PRESIGNED_URL;
      } else if (accessToken && err['code'] === 401) {

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
  };


  /**
   * Download the file.
   *
   * @param {Object} meta
   * @param fullDstPath
   *
   * @returns {null}
   */
  this.nativeDownloadFile = async function (meta, fullDstPath) {
    let downloadUrl = meta['presignedUrl'];
    let accessToken = null;
    let gcsHeaders = {};

    if (!downloadUrl) {
      downloadUrl = this.generateFileURL(
        meta.stageInfo['location'], lstrip(meta['srcFileName'], '/')
      );
      accessToken = meta['client'].gcsToken;
      gcsHeaders = { 'Authorization': `Bearer ${accessToken}` };
    }

    let encryptionDataprop;
    let matDescKey;
    let sfcDigest;
    let size;

    try {
      if (shouldPerformGCPBucket(accessToken)) {
        const gcsLocation = this.extractBucketNameAndPath(meta['stageInfo']['location']);

        await meta['client'].gcsClient
          .bucket(gcsLocation.bucketName)
          .file(gcsLocation.path + meta['srcFileName'])
          .download({
            destination: fullDstPath
          });

        const metadata = await meta['client'].gcsClient
          .bucket(gcsLocation.bucketName)
          .file(gcsLocation.path + meta['srcFileName'])
          .getMetadata();

        encryptionDataprop = metadata[0].metadata[ENCRYPTIONDATAPROP];
        matDescKey = metadata[0].metadata[MATDESC_KEY];
        sfcDigest = metadata[0].metadata[SFC_DIGEST];
        size = metadata[0].size;
      } else {
        let response;
        await axios({
          method: 'get',
          url: downloadUrl,
          headers: gcsHeaders,
          responseType: 'stream'
        }).then(async (res) => {
          response = res;
          await new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(fullDstPath);
            response.data.pipe(writer);
            writer.on('error', err => {
              writer.close();
              reject(err);
            });
            writer.on('close', () => {
              resolve();
            });
          });
        });

        encryptionDataprop = response.headers[GCS_METADATA_ENCRYPTIONDATAPROP];
        matDescKey = response.headers[GCS_METADATA_MATDESC_KEY];
        sfcDigest = response.headers[GCS_METADATA_SFC_DIGEST];
        size = response.headers['content-length'];
      }
    } catch (err) {
      if (err['code'] === EXPIRED_TOKEN) {
        meta['resultStatus'] = resultStatus.RENEW_TOKEN;
      } else {
        meta['lastError'] = err;
        if (err['code'] === ERRORNO_WSAECONNABORTED) {
          meta['resultStatus'] = resultStatus.NEED_RETRY_WITH_LOWER_CONCURRENCY;
        } else {
          meta['resultStatus'] = resultStatus.NEED_RETRY;
        }
      }
      return;
    }

    let encryptionData;
    if (encryptionDataprop) {
      encryptionData = JSON.parse(encryptionDataprop);
    }

    let encryptionMetadata;
    if (encryptionData) {
      encryptionMetadata = EncryptionMetadata(
        encryptionData['WrappedContentKey']['EncryptedKey'],
        encryptionData['ContentEncryptionIV'],
        matDescKey
      );
    }

    const fileInfo = fs.statSync(fullDstPath);
    meta['srcFileSize'] = fileInfo.size;

    meta['resultStatus'] = resultStatus.DOWNLOADED;

    meta[GCS_FILE_HEADER_DIGEST] = sfcDigest;
    meta[GCS_FILE_HEADER_CONTENT_LENGTH] = size;
    meta[GCS_FILE_HEADER_ENCRYPTION_METADATA] = encryptionMetadata;
  };

  /**
  * Generate file URL based on bucket.
  *
  * @param {String} stageLocation
  * @param {String} filename
  *
  * @returns {String}
  */
  this.generateFileURL = function (stageLocation, filename) {
    const gcsLocation = this.extractBucketNameAndPath(stageLocation);
    const fullFilePath = `${gcsLocation.path}${filename}`;
    const link = 'https://storage.googleapis.com/' + gcsLocation.bucketName + '/' + fullFilePath;
    return link;
  };

  /**
* Left strip the specified character from a string.
*
* @param {String} str
* @param {Character} remove
*
* @returns {String}
*/
  function lstrip(str, remove) {
    while (str.length > 0 && remove.indexOf(str.charAt(0)) !== -1) {
      str = str.substr(1);
    }
    return str;
  }
}

module.exports = GCSUtil;
