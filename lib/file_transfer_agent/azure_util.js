const AZURE = require('@azure/storage-blob');
const fs = require('fs');
const EncryptionMetadata = require('./encrypt_util').EncryptionMetadata;
const FileHeader = require('../file_util').FileHeader;
const expandTilde = require('expand-tilde');
const resultStatus = require('../file_util').resultStatus;
const ProxyUtil = require('../proxy_util');
const { isBypassProxy } = require('../http/node');
const Logger = require('../logger').default;

const EXPIRED_TOKEN = 'ExpiredToken';

// Azure Location
function AzureLocation(containerName, path) {
  return {
    containerName: containerName,
    path: path,
  };
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
function AzureUtil(connectionConfig) {
  /**
   * Create a blob service client using an Azure SAS token.
   *
   * @param {Object} stageInfo
   *
   * @returns {String}
   */
  this.createClient = function (stageInfo) {
    const stageCredentials = stageInfo['creds'];
    const sasToken = stageCredentials['AZURE_SAS_TOKEN'];

    const account = stageInfo['storageAccount'];
    const connectionString = `https://${account}.blob.core.windows.net${sasToken}`;
    let proxy = ProxyUtil.getProxy(connectionConfig.getProxy(), 'Azure Util');
    if (proxy && !isBypassProxy(proxy, connectionString)) {
      Logger().debug(
        `The destination host is: ${ProxyUtil.getHostFromURL(connectionString)} and the proxy host is: ${proxy.host}`,
      );
      Logger().trace(
        `Initializing the proxy information for the Azure Client: ${ProxyUtil.describeProxy(proxy)}`,
      );

      proxy = ProxyUtil.getAzureProxy(proxy);
    }
    ProxyUtil.hideEnvironmentProxy();
    const blobServiceClient = new AZURE.BlobServiceClient(connectionString, null, {
      proxyOptions: proxy,
    });
    ProxyUtil.restoreEnvironmentProxy();
    return blobServiceClient;
  };

  /**
   * Extract the container name and path from the metadata's stage location.
   *
   * @param {String} stageLocation
   *
   * @returns {Object}
   */
  this.extractContainerNameAndPath = function (stageLocation) {
    // expand '~' and '~user' expressions
    if (process.platform !== 'win32') {
      stageLocation = expandTilde(stageLocation);
    }

    let containerName = stageLocation;
    let path;

    // split stage location as bucket name and path
    if (stageLocation.includes('/')) {
      containerName = stageLocation.substring(0, stageLocation.indexOf('/'));

      path = stageLocation.substring(stageLocation.indexOf('/') + 1, stageLocation.length);
      if (path && !path.endsWith('/')) {
        path += '/';
      }
    }

    return AzureLocation(containerName, path);
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
    const stageInfo = meta['stageInfo'];
    const client = this.createClient(stageInfo);
    const azureLocation = this.extractContainerNameAndPath(stageInfo['location']);

    const containerClient = client.getContainerClient(azureLocation.containerName);
    const blobClient = containerClient.getBlobClient(azureLocation.path + filename);

    let blobDetails;

    try {
      await blobClient.getProperties().then(function (data) {
        blobDetails = data;
      });
    } catch (err) {
      if (err['code'] === EXPIRED_TOKEN) {
        meta['resultStatus'] = resultStatus.RENEW_TOKEN;
        return null;
      } else if (err['statusCode'] === 404) {
        meta['resultStatus'] = resultStatus.NOT_FOUND_FILE;
        return FileHeader(null, null, null);
      } else if (err['statusCode'] === 400) {
        meta['resultStatus'] = resultStatus.RENEW_TOKEN;
        return null;
      } else {
        meta['resultStatus'] = resultStatus.ERROR;
        return null;
      }
    }

    meta['resultStatus'] = resultStatus.UPLOADED;

    let encryptionMetadata = null;
    if (blobDetails.metadata['encryptiondata']) {
      const encryptionData = JSON.parse(blobDetails.metadata['encryptiondata']);
      encryptionMetadata = EncryptionMetadata(
        encryptionData['WrappedContentKey']['EncryptedKey'],
        encryptionData['ContentEncryptionIV'],
        blobDetails.metadata['matdesc'],
      );
    }

    return FileHeader(
      blobDetails.metadata['sfcdigest'],
      blobDetails.contentLength,
      encryptionMetadata,
    );
  };

  /**
   * Read the file into Buffers and upload via a single block-blob `upload`
   * (small files) or a multi-block `stageBlock` + `commitBlockList`
   * sequence (large files), depending on `uploadPartSizeMb`. Buffer-bodied
   * uploads bound in-flight memory by `uploadPartSizeMb` regardless of
   * file size, give per-block retry granularity for multipart, and align
   * with the pattern already used in the Python and Java connectors.
   *
   * @param {String} dataFile
   * @param {Object} meta
   * @param {Object} encryptionMetadata
   * @param {Number} maxConcurrency
   */
  this.uploadFile = async function (dataFile, meta, encryptionMetadata, maxConcurrency) {
    const partSize = connectionConfig.getUploadPartSizeBytes();
    const fileSize = (await fs.promises.stat(dataFile)).size;

    if (fileSize <= partSize) {
      // Single-block path: file fits in one Buffer and one `upload` call.
      const buffer = await fs.promises.readFile(dataFile);
      await this.uploadFileStream(buffer, meta, encryptionMetadata, maxConcurrency);
      return;
    }
    // Multi-block path: split into Buffer-bodied stageBlock calls.
    await this.uploadFileMultipart(dataFile, fileSize, partSize, meta, encryptionMetadata);
  };

  /**
   * Multi-block upload of `dataFile` to Azure Block Blob storage. Reads
   * `partSize` bytes per chunk into a fresh Buffer and stages each as a
   * separate `stageBlock` call, then commits the block list in order.
   *
   * Block IDs are deterministic, fixed-width strings (`block-NNNNNNNNNN`)
   * base64-encoded for the wire. Azure requires every block ID within a
   * single blob to decode to the same length; the fixed pre-encode width
   * satisfies that constraint without needing an outer fixed-width-format
   * check.
   *
   * On any error before commit, best-effort `deleteIfExists` runs on the
   * target blob to release any uncommitted blocks. Azure auto-GCs
   * uncommitted blocks after a week regardless, so the explicit cleanup
   * is just to avoid leaving the stage in a confusing intermediate state
   * for the immediate retry.
   *
   * @param {String} dataFile - Local file path to upload.
   * @param {Number} fileSize - Pre-stat'd file size in bytes.
   * @param {Number} partSize - Configured upload part size; each in-flight
   *                            block allocates at most this many bytes.
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
    const azureMetadata = buildAzureMetadata(meta, encryptionMetadata);

    const stageInfo = meta['stageInfo'];
    const client = this.createClient(stageInfo);
    const azureLocation = this.extractContainerNameAndPath(stageInfo['location']);
    const blobName = azureLocation.path + meta['dstFileName'];

    const containerClient = client.getContainerClient(azureLocation.containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    const blockIds = [];
    let stagedAny = false;
    try {
      const fd = await fs.promises.open(dataFile, 'r');
      try {
        let position = 0;
        let partNumber = 1;
        while (position < fileSize) {
          const remaining = fileSize - position;
          const thisPartSize = Math.min(partSize, remaining);
          // allocUnsafe: the very next line fills via `fd.read(...)` and the
          // bytesRead check below throws before uninitialized memory could
          // be observed by `stageBlock`. Zero-fill is wasted I/O.
          const buf = Buffer.allocUnsafe(thisPartSize);
          const { bytesRead } = await fd.read(buf, 0, thisPartSize, position);
          if (bytesRead !== thisPartSize) {
            // The file shrank or read was short for some other reason. Bail
            // rather than commit a block list that won't match `fileSize`.
            throw new Error(
              `Short read at offset ${position}: expected ${thisPartSize} bytes, got ${bytesRead}`,
            );
          }
          const blockId = encodeBlockId(partNumber);
          try {
            await blockBlobClient.stageBlock(blockId, buf, thisPartSize);
          } catch (err) {
            applyAzureUploadError(err, meta);
            // Re-throw so the outer catch issues the cleanup; we don't want
            // a half-staged block list lingering on the blob.
            throw err;
          }
          stagedAny = true;
          blockIds.push(blockId);
          position += bytesRead;
          partNumber++;
        }
      } finally {
        await fd.close();
      }

      try {
        await blockBlobClient.commitBlockList(blockIds, {
          metadata: azureMetadata,
          blobHTTPHeaders: {
            blobContentEncoding: 'UTF-8',
            blobContentType: 'application/octet-stream',
          },
        });
      } catch (err) {
        applyAzureUploadError(err, meta);
        throw err;
      }

      meta['dstFileSize'] = meta['uploadSize'];
      meta['resultStatus'] = resultStatus.UPLOADED;
    } catch (err) {
      // If we have any staged blocks, best-effort delete the blob to release
      // them. Azure auto-GCs uncommitted blocks within a week, so this is
      // only for hygiene during the immediate retry — surfacing the cleanup
      // error would mask the original cause.
      if (stagedAny) {
        try {
          await blockBlobClient.deleteIfExists();
        } catch (_cleanupErr) {
          // Suppress.
        }
      }
      // applyAzureUploadError has already populated meta if it was an Azure
      // error (RENEW_TOKEN / NEED_RETRY); for other errors (e.g., short
      // read) record the raw error so the caller's retry logic still kicks
      // in. Stale `UPLOADED` from a reused meta must be overwritten — we
      // got here from a failure.
      if (!meta['resultStatus'] || meta['resultStatus'] === resultStatus.UPLOADED) {
        meta['lastError'] = err;
        meta['resultStatus'] = resultStatus.NEED_RETRY;
      }
    }
  };

  /**
   * Create the file metadata then upload the file stream.
   *
   * @param {Buffer|string|stream.Readable} fileStream
   * @param {Object} meta
   * @param {Object} encryptionMetadata
   * @param {Number} maxConcurrency
   *
   * @returns {null}
   */
  this.uploadFileStream = async function (fileStream, meta, encryptionMetadata, maxConcurrency) {
    const azureMetadata = {
      sfcdigest: meta['SHA256_DIGEST'],
    };

    if (encryptionMetadata) {
      azureMetadata['encryptiondata'] = JSON.stringify({
        EncryptionMode: 'FullBlob',
        WrappedContentKey: {
          KeyId: 'symmKey1',
          EncryptedKey: encryptionMetadata.key,
          Algorithm: 'AES_CBC_256',
        },
        EncryptionAgent: {
          Protocol: '1.0',
          EncryptionAlgorithm: 'AES_CBC_128',
        },
        ContentEncryptionIV: encryptionMetadata.iv,
        KeyWrappingMetadata: {
          EncryptionLibrary: 'Java 5.3.0',
        },
      });
      azureMetadata['matdesc'] = encryptionMetadata.matDesc;
    }

    const stageInfo = meta['stageInfo'];
    const client = this.createClient(stageInfo);
    const azureLocation = this.extractContainerNameAndPath(stageInfo['location']);
    const blobName = azureLocation.path + meta['dstFileName'];

    const containerClient = client.getContainerClient(azureLocation.containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    try {
      const uploadOptions = {
        metadata: azureMetadata,
        blobHTTPHeaders: {
          blobContentEncoding: 'UTF-8',
          blobContentType: 'application/octet-stream',
        },
      };

      if (Buffer.isBuffer(fileStream) || typeof fileStream === 'string') {
        const contentLength =
          typeof fileStream === 'string' ? Buffer.byteLength(fileStream) : fileStream.length;
        await blockBlobClient.upload(fileStream, contentLength, uploadOptions);
      } else {
        const bufferSize = 4 * 1024 * 1024; // 4 MiB
        const concurrency =
          Number.isInteger(maxConcurrency) && maxConcurrency > 0 ? maxConcurrency : 1;
        await blockBlobClient.uploadStream(fileStream, bufferSize, concurrency, uploadOptions);
      }
    } catch (err) {
      if (err['statusCode'] === 403 && detectAzureTokenExpireError(err)) {
        meta['lastError'] = err;
        meta['resultStatus'] = resultStatus.RENEW_TOKEN;
        return;
      } else {
        meta['lastError'] = err;
        meta['resultStatus'] = resultStatus.NEED_RETRY;
      }
      return;
    }
    meta['dstFileSize'] = meta['uploadSize'];
    meta['resultStatus'] = resultStatus.UPLOADED;
  };

  /**
   * Download the file blob then write the file.
   *
   * @param {Object} meta
   * @param fullDstPath
   *
   * @returns {null}
   */
  this.nativeDownloadFile = async function (meta, fullDstPath) {
    const stageInfo = meta['stageInfo'];
    const client = this.createClient(stageInfo);
    const azureLocation = this.extractContainerNameAndPath(stageInfo['location']);
    const blobName = azureLocation.path + meta['srcFileName'];

    const containerClient = client.getContainerClient(azureLocation.containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    try {
      const downloadBlockBlobResponse = await blockBlobClient.download(0);
      const readableStream = downloadBlockBlobResponse.readableStreamBody;
      Logger().debug(
        `Sent Get Request to ${blockBlobClient.url.split('?')[0]}, destination: ${fullDstPath}, http status: ${downloadBlockBlobResponse.originalResponse._response.status}`,
      );

      await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(fullDstPath);
        readableStream.on('data', (data) => {
          writer.write(data);
        });
        readableStream.on('end', () => {
          writer.end(resolve);
        });
        readableStream.on('error', reject);
      });
    } catch (err) {
      if (err['statusCode'] === 403 && detectAzureTokenExpireError(err)) {
        meta['lastError'] = err;
        meta['resultStatus'] = resultStatus.RENEW_TOKEN;
        return;
      } else {
        meta['lastError'] = err;
        meta['resultStatus'] = resultStatus.NEED_RETRY;
      }
      return;
    }
    meta['resultStatus'] = resultStatus.DOWNLOADED;
  };

  /**
   * Detect if the Azure token has expired.
   *
   * @param {Object} err
   *
   * @returns {Boolean}
   */
  function detectAzureTokenExpireError(err) {
    if (err['statusCode'] !== 403) {
      return false;
    }
    const errstr = err.toString();
    return (
      errstr.includes('Signature not valid in the specified time frame') ||
      errstr.includes('Server failed to authenticate the request.')
    );
  }

  /**
   * Translate an Azure SDK error into the file-transfer-agent's
   * `meta.resultStatus` convention. Used by `uploadFileMultipart` from
   * each stageBlock and the commitBlockList catch sites so retry
   * semantics stay consistent across them.
   */
  function applyAzureUploadError(err, meta) {
    if (err && err['statusCode'] === 403 && detectAzureTokenExpireError(err)) {
      meta['lastError'] = err;
      meta['resultStatus'] = resultStatus.RENEW_TOKEN;
    } else {
      meta['lastError'] = err;
      meta['resultStatus'] = resultStatus.NEED_RETRY;
    }
  }

  /**
   * Build the Azure blob metadata block (including the encryption envelope
   * when the upload is encrypted) for `uploadFileMultipart`. The single-
   * block path constructs its own metadata inline; this helper exists so
   * the multipart commit reuses the exact same envelope shape.
   */
  function buildAzureMetadata(meta, encryptionMetadata) {
    const azureMetadata = {
      sfcdigest: meta['SHA256_DIGEST'],
    };
    if (encryptionMetadata) {
      azureMetadata['encryptiondata'] = JSON.stringify({
        EncryptionMode: 'FullBlob',
        WrappedContentKey: {
          KeyId: 'symmKey1',
          EncryptedKey: encryptionMetadata.key,
          Algorithm: 'AES_CBC_256',
        },
        EncryptionAgent: {
          Protocol: '1.0',
          EncryptionAlgorithm: 'AES_CBC_128',
        },
        ContentEncryptionIV: encryptionMetadata.iv,
        KeyWrappingMetadata: {
          EncryptionLibrary: 'Java 5.3.0',
        },
      });
      azureMetadata['matdesc'] = encryptionMetadata.matDesc;
    }
    return azureMetadata;
  }

  /**
   * Encode a 1-based part number into a base64 block ID. Azure requires
   * every block ID within a single blob to decode to the same length;
   * we use a 16-byte fixed-width pre-encode form so all IDs base64-encode
   * to a uniform 24-character string.
   */
  function encodeBlockId(partNumber) {
    return Buffer.from(`block-${String(partNumber).padStart(10, '0')}`).toString('base64');
  }
}

module.exports = AzureUtil;
