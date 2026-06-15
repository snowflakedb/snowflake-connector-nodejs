const AZURE = require('@azure/storage-blob');
const fs = require('fs');
const EncryptionMetadata = require('./encrypt_util').EncryptionMetadata;
const FileHeader = require('../file_util').FileHeader;
const expandTilde = require('expand-tilde');
const resultStatus = require('../file_util').resultStatus;
const ProxyUtil = require('../proxy_util');
const { isBypassProxy } = require('../http/node');
const Logger = require('../logger').default;
const { MULTIPART_THRESHOLD_BYTES, MULTIPART_PART_SIZE_BYTES, readChunk } = require('./multipart');

const EXPIRED_TOKEN = 'ExpiredToken';
const AZURE_BLOB_HTTP_HEADERS = {
  blobContentEncoding: 'UTF-8',
  blobContentType: 'application/octet-stream',
};

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
   * sequence (large files), depending on `MULTIPART_THRESHOLD_BYTES`.
   * Buffer-bodied uploads bound in-flight memory by `MULTIPART_PART_SIZE_BYTES`
   * regardless of file size, give per-block retry granularity for multipart,
   * and align with the pattern already used in the Python and Java connectors.
   *
   * @param {String} dataFile
   * @param {Object} meta
   * @param {Object} encryptionMetadata
   * @param {Number} maxConcurrency
   */
  this.uploadFile = async function (dataFile, meta, encryptionMetadata, maxConcurrency) {
    const fileSize = (await fs.promises.stat(dataFile)).size;

    if (fileSize > MULTIPART_THRESHOLD_BYTES) {
      await this.uploadFileMultipart(dataFile, fileSize, meta, encryptionMetadata);
    } else {
      const fileStream = fs.createReadStream(dataFile);
      await this.uploadFileStream(fileStream, meta, encryptionMetadata, maxConcurrency);
    }
  };

  /**
   * Multi-block upload of `dataFile` to Azure Block Blob storage. Reads
   * `MULTIPART_PART_SIZE_BYTES` bytes per chunk into a fresh Buffer and stages
   * each as a separate `stageBlock` call, then commits the block list in order.
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
   * @param {Object} meta
   * @param {Object} encryptionMetadata
   */
  this.uploadFileMultipart = async function (dataFile, fileSize, meta, encryptionMetadata) {
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
          const thisPartSize = Math.min(MULTIPART_PART_SIZE_BYTES, fileSize - position);
          const buf = await readChunk(fd, position, thisPartSize);
          const blockId = encodeBlockId(partNumber);
          await blockBlobClient.stageBlock(blockId, buf, thisPartSize);
          stagedAny = true;
          blockIds.push(blockId);
          position += thisPartSize;
          partNumber++;
        }
      } finally {
        await fd.close();
      }

      await blockBlobClient.commitBlockList(blockIds, {
        metadata: azureMetadata,
        blobHTTPHeaders: AZURE_BLOB_HTTP_HEADERS,
      });

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
      applyAzureUploadError(err, meta);
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
    const azureMetadata = buildAzureMetadata(meta, encryptionMetadata);

    const stageInfo = meta['stageInfo'];
    const client = this.createClient(stageInfo);
    const azureLocation = this.extractContainerNameAndPath(stageInfo['location']);
    const blobName = azureLocation.path + meta['dstFileName'];

    const containerClient = client.getContainerClient(azureLocation.containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    try {
      const uploadOptions = {
        metadata: azureMetadata,
        blobHTTPHeaders: AZURE_BLOB_HTTP_HEADERS,
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
      applyAzureUploadError(err, meta);
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
   * Classify an upload failure into the file-transfer-agent's
   * `meta.resultStatus` convention so retry semantics stay consistent across
   * every catch site. The error may be an Azure SDK error (mapped to
   * RENEW_TOKEN) or any other JS error (e.g. a short read), which falls back
   * to NEED_RETRY.
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
   * Build the Azure blob metadata block, including the encryption envelope
   * when the upload is encrypted, so every upload path commits the same
   * envelope shape.
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
   * Encode a 1-based part number into a block ID.
   *
   * Azure requires each block ID to be a Base64-encoded string, and every
   * block ID within a single blob must be the same length.
   */
  function encodeBlockId(partNumber) {
    return Buffer.from(`block-${String(partNumber).padStart(10, '0')}`).toString('base64');
  }
}

module.exports = AzureUtil;
