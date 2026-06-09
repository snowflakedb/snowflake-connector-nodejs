const { NodeHttpHandler } = require('@smithy/node-http-handler');
const EncryptionMetadata = require('./encrypt_util').EncryptionMetadata;
const FileHeader = require('../file_util').FileHeader;
const expandTilde = require('expand-tilde');
const getProxyAgent = require('../http/node').getProxyAgent;
const ProxyUtil = require('../proxy_util');
const Logger = require('../logger').default;

const AMZ_IV = 'x-amz-iv';
const AMZ_KEY = 'x-amz-key';
const AMZ_MATDESC = 'x-amz-matdesc';
const SFC_DIGEST = 'sfc-digest';

const EXPIRED_TOKEN = 'ExpiredToken';
const NO_SUCH_KEY = 'NoSuchKey';
const SNOWFLAKE_S3_DESTINATION = 's3.amazonaws.com';

const ERRORNO_WSAECONNABORTED = 10053; // network connection was aborted
const DATA_SIZE_THRESHOLD = 67108864; // magic number, given from  error message.

const resultStatus = require('../file_util').resultStatus;

const HTTP_HEADER_VALUE_OCTET_STREAM = 'application/octet-stream';

// S3 Location: S3 bucket name + path
function S3Location(bucketName, s3path) {
  return {
    bucketName: bucketName, // S3 bucket name
    s3path: s3path, // S3 path name
  };
}

/**
 * Creates an S3 utility object.
 *
 * @param connectionConfig
 *
 * @param s3 - used for tests, mock can be supplied
 * @param filestream - used for tests, mock can be supplied
 * @returns {Object}
 * @constructor
 */
function S3Util(connectionConfig, s3, filestream) {
  const AWS = typeof s3 !== 'undefined' ? s3 : require('@aws-sdk/client-s3');
  const fs = typeof filestream !== 'undefined' ? filestream : require('fs');
  /**
   * Create an AWS S3 client using an AWS token.
   */
  this.createClient = function (stageInfo, useAccelerateEndpoint) {
    const stageCredentials = stageInfo['creds'];
    const securityToken = stageCredentials['AWS_TOKEN'];
    const isRegionalUrlEnabled = stageInfo.useRegionalUrl || stageInfo.useS3RegionalUrl;

    // if GS sends us an endpoint, it's likely for FIPS. Use it.
    let endPoint = null;
    if (stageInfo['endPoint']) {
      endPoint = `https://${stageInfo['endPoint']}`;
    } else {
      if (stageInfo.region && isRegionalUrlEnabled) {
        const domainSuffixForRegionalUrl = stageInfo.region.toLowerCase().startsWith('cn-')
          ? 'amazonaws.com.cn'
          : 'amazonaws.com';
        endPoint = `https://s3.${stageInfo.region}.${domainSuffixForRegionalUrl}`;
      }
    }

    const config = {
      apiVersion: '2006-03-01',
      region: stageInfo['region'],
      credentials: {
        accessKeyId: stageCredentials['AWS_KEY_ID'],
        secretAccessKey: stageCredentials['AWS_SECRET_KEY'],
        sessionToken: securityToken,
      },
      endpoint: endPoint,
      useAccelerateEndpoint: useAccelerateEndpoint,
    };

    const proxy = ProxyUtil.getProxy(connectionConfig.getProxy(), 'S3 Util');
    if (proxy) {
      const proxyAgent = getProxyAgent({
        proxyOptions: proxy,
        connectionConfig,
        parsedUrl: new URL(connectionConfig.accessUrl),
        destination: endPoint || SNOWFLAKE_S3_DESTINATION,
      });
      config.requestHandler = new NodeHttpHandler({
        httpAgent: proxyAgent,
        httpsAgent: proxyAgent,
      });
    }

    return new AWS.S3(config);
  };

  /**
   * Get file header based on file being uploaded or not.
   *
   * @param {Object} meta
   * @param {String} filename
   *
   * @returns {Object}
   */
  this.getFileHeader = async function (meta, filename) {
    const stageInfo = meta['stageInfo'];
    const client = this.createClient(stageInfo);
    try {
      const s3location = extractBucketNameAndPath(stageInfo['location']);

      const params = {
        Bucket: s3location.bucketName,
        Key: s3location.s3path + filename,
      };

      let akey;

      try {
        await client.getObject(params).then(function (data) {
          akey = data;
        });
      } catch (err) {
        if (err['Code'] === EXPIRED_TOKEN) {
          meta['resultStatus'] = resultStatus.RENEW_TOKEN;
          return null;
        } else if (err['Code'] === NO_SUCH_KEY) {
          meta['resultStatus'] = resultStatus.NOT_FOUND_FILE;
          return FileHeader(null, null, null);
        } else if (err['Code'] === '400') {
          meta['resultStatus'] = resultStatus.RENEW_TOKEN;
          return null;
        } else {
          meta['resultStatus'] = resultStatus.ERROR;
          return null;
        }
      }

      meta['resultStatus'] = resultStatus.UPLOADED;

      let encryptionMetadata;
      if (akey && akey.Metadata[AMZ_KEY]) {
        encryptionMetadata = EncryptionMetadata(
          akey.Metadata[AMZ_KEY],
          akey.Metadata[AMZ_IV],
          akey.Metadata[AMZ_MATDESC],
        );
      }

      return FileHeader(akey.Metadata[SFC_DIGEST], akey.ContentLength, encryptionMetadata);
    } finally {
      client.destroy();
    }
  };

  /**
   * Read the file into Buffers and upload via PutObject (small files) or S3
   * multipart upload (large files), depending on `connectionConfig.uploadPartSizeMb`.
   *
   * Why Buffer-bodied uploads, not a Readable stream:
   *  - Memory per upload is bounded by `uploadPartSizeMb`, regardless of file size.
   *  - Per-part retry granularity for multipart on transient errors (vs.
   *    re-uploading the whole file on a single-PutObject failure).
   *  - Aligns with the multipart pattern already used in the Python and
   *    Java connectors and AWS's recommendation for non-trivial uploads.
   *  - Buffer body with a known `Content-Length` upfront sidesteps
   *    `Transfer-Encoding: chunked` and `STREAMING-UNSIGNED-PAYLOAD-TRAILER`
   *    mode, giving a more predictable wire shape on retry.
   *
   * @param {String} dataFile
   * @param {Object} meta
   * @param {Object} encryptionMetadata
   */
  this.uploadFile = async function (dataFile, meta, encryptionMetadata) {
    const partSize = connectionConfig.getUploadPartSizeBytes();
    const fileSize = (await fs.promises.stat(dataFile)).size;

    if (fileSize <= partSize) {
      // Single-PutObject path: file fits in one part.
      const buffer = await fs.promises.readFile(dataFile);
      await this.uploadFileStream(buffer, meta, encryptionMetadata);
      return;
    }
    // Multipart path: split into Buffer-bodied UploadPart calls.
    await this.uploadFileMultipart(dataFile, fileSize, partSize, meta, encryptionMetadata);
  };

  /**
   * Multipart upload of `dataFile` to S3, reading `partSize` bytes per chunk
   * into a fresh Buffer and uploading each as a separate UploadPart call.
   *
   * On any error (token expiry, transient network failure, etc.), best-effort
   * `AbortMultipartUpload` is issued so we don't leak partial-upload storage.
   * The caller's existing retry semantics (RENEW_TOKEN / NEED_RETRY result
   * statuses) layer cleanly on top: a failed upload leaves the stage clean
   * for the retry to start over.
   *
   * @param {String} dataFile - Local file path to upload.
   * @param {Number} fileSize - Pre-stat'd file size in bytes.
   * @param {Number} partSize - Configured upload part size; each in-flight
   *                            part allocates at most this many bytes.
   * @param {Object} meta
   * @param {Object} encryptionMetadata
   */
  this.uploadFileMultipart = async function (
    dataFile,
    fileSize,
    partSize,
    meta,
    encryptionMetadata,
  ) {
    const s3Metadata = {
      HTTP_HEADER_CONTENT_TYPE: HTTP_HEADER_VALUE_OCTET_STREAM,
      SFC_DIGEST: meta['SHA256_DIGEST'],
    };
    if (encryptionMetadata) {
      s3Metadata[AMZ_IV] = encryptionMetadata.iv;
      s3Metadata[AMZ_KEY] = encryptionMetadata.key;
      s3Metadata[AMZ_MATDESC] = encryptionMetadata.matDesc;
    }

    const stageInfo = meta['stageInfo'];
    const client = this.createClient(stageInfo);
    const s3location = extractBucketNameAndPath(meta['stageInfo']['location']);
    const Bucket = s3location.bucketName;
    const Key = s3location.s3path + meta['dstFileName'];

    let uploadId;
    try {
      let createResp;
      try {
        createResp = await client.createMultipartUpload({
          Bucket,
          Key,
          Metadata: s3Metadata,
        });
      } catch (err) {
        applyS3UploadError(err, meta);
        return;
      }
      uploadId = createResp.UploadId;

      const fd = await fs.promises.open(dataFile, 'r');
      const parts = [];
      try {
        let position = 0;
        let partNumber = 1;
        while (position < fileSize) {
          const remaining = fileSize - position;
          const thisPartSize = Math.min(partSize, remaining);
          // allocUnsafe is correct here: the very next line fills the buffer
          // with `fd.read(...)`, and the `bytesRead !== thisPartSize` check
          // throws before any uninitialized memory could be observed by
          // `client.uploadPart`. Zero-fill (`Buffer.alloc`) would be wasted
          // I/O on multi-GiB uploads.
          const buf = Buffer.allocUnsafe(thisPartSize);
          const { bytesRead } = await fd.read(buf, 0, thisPartSize, position);
          if (bytesRead !== thisPartSize) {
            // The file shrank or read was short for some other reason. Bail
            // rather than upload a partial part that won't match `fileSize`
            // when we go to CompleteMultipartUpload.
            throw new Error(
              `Short read at offset ${position}: expected ${thisPartSize} bytes, got ${bytesRead}`,
            );
          }
          let partResp;
          try {
            partResp = await client.uploadPart({
              Bucket,
              Key,
              UploadId: uploadId,
              PartNumber: partNumber,
              Body: buf,
            });
          } catch (err) {
            applyS3UploadError(err, meta);
            // Re-throw so the outer catch issues the abort; we don't want a
            // half-completed multipart upload sitting in the bucket.
            throw err;
          }
          parts.push({ ETag: partResp.ETag, PartNumber: partNumber });
          position += bytesRead;
          partNumber++;
        }
      } finally {
        await fd.close();
      }

      try {
        await client.completeMultipartUpload({
          Bucket,
          Key,
          UploadId: uploadId,
          MultipartUpload: { Parts: parts },
        });
      } catch (err) {
        applyS3UploadError(err, meta);
        throw err;
      }

      meta['dstFileSize'] = meta['uploadSize'];
      meta['resultStatus'] = resultStatus.UPLOADED;
    } catch (err) {
      // If we have an in-flight upload, best-effort abort to release storage.
      if (uploadId) {
        try {
          await client.abortMultipartUpload({ Bucket, Key, UploadId: uploadId });
        } catch (_abortErr) {
          // Suppress — surfacing the abort error would mask the original cause.
        }
      }
      // applyS3UploadError has already populated meta if it was an S3 error;
      // for other errors (e.g., short read) record the raw error so the
      // caller's retry logic still kicks in.
      // applyS3UploadError has already populated meta if it was an S3 error
      // (RENEW_TOKEN / NEED_RETRY / NEED_RETRY_WITH_LOWER_CONCURRENCY); for
      // other errors (e.g., short read) record the raw error so the caller's
      // retry logic still kicks in. Stale `UPLOADED` from a reused meta must
      // be overwritten — we got here from a failure.
      if (!meta['resultStatus'] || meta['resultStatus'] === resultStatus.UPLOADED) {
        meta['lastError'] = err;
        meta['resultStatus'] = resultStatus.NEED_RETRY;
      }
    } finally {
      client.destroy();
    }
  };

  /**
   * Single-PutObject upload of `fileStream` to S3.
   *
   * Internal SDK callers always reach this with a Buffer: the encrypt path
   * produces a Buffer, and `uploadFile`'s small-file branch reads to a
   * Buffer. The Readable arm is preserved only for the legacy
   * `uploadOneFileStream` codepath in `remote_storage_util.js`, which
   * external SDK consumers may still drive — that path bypasses the
   * memory-bounded multipart branch entirely. Prefer `uploadFile(path,...)`
   * for any new caller.
   *
   * @param {Buffer|string|stream.Readable} fileStream
   * @param {Object} meta
   * @param {Object} encryptionMetadata
   */
  this.uploadFileStream = async function (fileStream, meta, encryptionMetadata) {
    const s3Metadata = {
      HTTP_HEADER_CONTENT_TYPE: HTTP_HEADER_VALUE_OCTET_STREAM,
      SFC_DIGEST: meta['SHA256_DIGEST'],
    };

    if (encryptionMetadata) {
      s3Metadata[AMZ_IV] = encryptionMetadata.iv;
      s3Metadata[AMZ_KEY] = encryptionMetadata.key;
      s3Metadata[AMZ_MATDESC] = encryptionMetadata.matDesc;
    }

    const stageInfo = meta['stageInfo'];
    const client = this.createClient(stageInfo);
    try {
      const s3location = extractBucketNameAndPath(meta['stageInfo']['location']);

      const params = {
        Bucket: s3location.bucketName,
        Body: fileStream,
        Key: s3location.s3path + meta['dstFileName'],
        Metadata: s3Metadata,
      };

      // call S3 to upload file to specified bucket
      try {
        await client.putObject(params);
      } catch (err) {
        applyS3UploadError(err, meta);
        return;
      }

      meta['dstFileSize'] = meta['uploadSize'];
      meta['resultStatus'] = resultStatus.UPLOADED;
    } finally {
      client.destroy();
    }
  };

  /**
   * Download the file.
   *
   * @param {String} dataFile
   * @param {Object} meta
   * @param {Object} encryptionMetadata
   */
  this.nativeDownloadFile = async function (meta, fullDstPath) {
    const stageInfo = meta['stageInfo'];
    const client = this.createClient(stageInfo);
    try {
      const s3location = extractBucketNameAndPath(meta['stageInfo']['location']);

      const params = {
        Bucket: s3location.bucketName,
        Key: s3location.s3path + meta['dstFileName'],
      };

      // call S3 to download file to specified bucket
      try {
        Logger().debug(
          `Send Get Request to the Bucket: ${params.Bucket}, GET request: ${params.Key}`,
        );
        await client
          .getObject(params)
          .then((data) => {
            Logger().debug(
              `Http Status for the GET request: ${params.Key} : ${data.$metadata.httpStatusCode}`,
            );
            return data.Body.transformToByteArray();
          })
          .then((data) => {
            return new Promise((resolve, reject) => {
              fs.writeFile(fullDstPath, data, 'binary', (err) => {
                if (err) {
                  reject(err);
                }
                resolve();
              });
            });
          });
      } catch (err) {
        if (err['Code'] === EXPIRED_TOKEN) {
          meta['resultStatus'] = resultStatus.RENEW_TOKEN;
        } else {
          meta['lastError'] = err;
          if (err['Code'] === ERRORNO_WSAECONNABORTED.toString()) {
            meta['resultStatus'] = resultStatus.NEED_RETRY_WITH_LOWER_CONCURRENCY;
          } else {
            meta['resultStatus'] = resultStatus.NEED_RETRY;
          }
        }
        return;
      }
      meta['resultStatus'] = resultStatus.DOWNLOADED;
    } finally {
      client.destroy();
    }
  };
}

/**
 * Extract the bucket name and path from the metadata's stage location.
 *
 * @param {String} stageLocation
 *
 * @returns {Object}
 */
function extractBucketNameAndPath(stageLocation) {
  // expand '~' and '~user' expressions
  if (process.platform !== 'win32') {
    stageLocation = expandTilde(stageLocation);
  }

  let bucketName = stageLocation;
  let s3path;

  // split stage location as bucket name and path
  if (stageLocation.includes('/')) {
    bucketName = stageLocation.substring(0, stageLocation.indexOf('/'));

    s3path = stageLocation.substring(stageLocation.indexOf('/') + 1, stageLocation.length);
    if (s3path && !s3path.endsWith('/')) {
      s3path += '/';
    }
  }
  return S3Location(bucketName, s3path);
}

/**
 * Translate an S3 SDK error into the file-transfer-agent's `meta.resultStatus`
 * convention. Shared by single-PutObject (`uploadFileStream`) and multipart
 * (`uploadFileMultipart`) paths so retry semantics stay consistent.
 */
function applyS3UploadError(err, meta) {
  if (err && err['Code'] === EXPIRED_TOKEN) {
    meta['resultStatus'] = resultStatus.RENEW_TOKEN;
  } else {
    meta['lastError'] = err;
    if (err && err['Code'] === ERRORNO_WSAECONNABORTED.toString()) {
      meta['resultStatus'] = resultStatus.NEED_RETRY_WITH_LOWER_CONCURRENCY;
    } else {
      meta['resultStatus'] = resultStatus.NEED_RETRY;
    }
  }
}

module.exports = {
  S3Util,
  SNOWFLAKE_S3_DESTINATION,
  DATA_SIZE_THRESHOLD,
  extractBucketNameAndPath,
};
