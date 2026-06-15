const fs = require('fs');
const EncryptionMetadata = require('./encrypt_util').EncryptionMetadata;
const FileHeader = require('../file_util').FileHeader;
const getProxyAgent = require('../http/node').getProxyAgent;
const ProxyUtil = require('../proxy_util');
const Util = require('../util');
const { lstrip } = require('../util');
const Logger = require('../logger').default;
const { MULTIPART_THRESHOLD_BYTES, MULTIPART_PART_SIZE_BYTES, readChunk } = require('./multipart');

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
const resultStatus = require('../file_util').resultStatus;

const EXPIRED_TOKEN = 'ExpiredToken';
const ERRORNO_WSAECONNABORTED = 10053; // network connection was aborted

/**
 * Creates an GCS utility object.
 * @param {module} connectionConfig
 * @param {module} httpClient
 * @param {module} fileStream
 *
 * @returns {Object}
 * @constructor
 */
function GCSUtil(connectionConfig, httpClient) {
  let axios = httpClient;

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
    // TODO: SNOW-1789759 the value is hardcoded now, but it should be server driven
    const endPoint = this.getGCSCustomEndPoint(stageInfo);

    const client = gcsToken ? { gcsToken } : null;

    this.setupHttpClient(endPoint);

    return client;
  };

  /**
   * Extract the bucket name and path from the metadata's stage location.
   *
   * @param {String} stageLocation
   *
   * @returns {GCSLocation}
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
    if (
      meta['resultStatus'] === resultStatus.UPLOADED ||
      meta['resultStatus'] === resultStatus.DOWNLOADED
    ) {
      return FileHeader(
        meta[GCS_FILE_HEADER_DIGEST],
        meta[GCS_FILE_HEADER_CONTENT_LENGTH],
        meta[GCS_FILE_HEADER_ENCRYPTION_METADATA],
      );
    } else {
      if (meta['presignedUrl']) {
        await axios.get(meta['presignedUrl']).catch((err) => {
          if ([401, 403, 404].includes(err.response.status)) {
            meta['resultStatus'] = resultStatus.NOT_FOUND_FILE;
          }
        });
      } else {
        const url = this.generateFileURL(meta.stageInfo, lstrip(filename, '/'));
        const accessToken = meta['client'].gcsToken;
        const gcsHeaders = { Authorization: `Bearer ${accessToken}` };

        try {
          const response = await axios.head(url, { headers: gcsHeaders });

          const digest = response.headers[GCS_METADATA_SFC_DIGEST];
          const contentLength = response.headers['content-length'];
          const encryptionDataProp = response.headers[GCS_METADATA_ENCRYPTIONDATAPROP];
          const matDescKey = response.headers[GCS_METADATA_MATDESC_KEY];

          let encryptionMetadata;
          if (encryptionDataProp) {
            const encryptionData = JSON.parse(encryptionDataProp);
            if (encryptionData) {
              encryptionMetadata = EncryptionMetadata(
                encryptionData['WrappedContentKey']['EncryptedKey'],
                encryptionData['ContentEncryptionIV'],
                matDescKey ? matDescKey : null,
              );
            }
          }

          meta['resultStatus'] = resultStatus.UPLOADED;

          return FileHeader(digest, contentLength, encryptionMetadata);
        } catch (err) {
          const errCode =
            !isNaN(err['code']) && !isNaN(parseInt(err['code']))
              ? err['code']
              : err.response.status;

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
   * Read the file's stat, then dispatch to one of two upload paths:
   *
   *   1. **Single Buffer-bodied PUT** — when the session uses a legacy
   *      presigned URL (which is signed for one specific PUT and cannot
   *      initiate a resumable session) or the file is no larger than
   *      `MULTIPART_THRESHOLD_BYTES`.
   *   2. **XML API resumable upload session** — when an access token is
   *      available and the file exceeds `MULTIPART_THRESHOLD_BYTES`. Bounds
   *      in-flight memory by `MULTIPART_PART_SIZE_BYTES` and gives per-chunk
   *      retry granularity. See `uploadFileResumable` for protocol
   *      details.
   *
   * @param {String} dataFile
   * @param {Object} meta
   * @param {Object} encryptionMetadata
   * @param {Number} maxConcurrency
   */
  this.uploadFile = async function (dataFile, meta, encryptionMetadata, maxConcurrency) {
    const fileSize = (await fs.promises.stat(dataFile)).size;
    meta['uploadFileSize'] = fileSize;

    const accessToken = meta['client'] && meta['client'].gcsToken;
    const usingPresignedUrl = !!meta['presignedUrl'];
    const canResumable = !!accessToken && !usingPresignedUrl;

    if (canResumable && fileSize > MULTIPART_THRESHOLD_BYTES) {
      await this.uploadFileResumable(dataFile, fileSize, meta, encryptionMetadata);
    } else {
      const fileStream = fs.createReadStream(dataFile);
      await this.uploadFileStream(fileStream, meta, encryptionMetadata, maxConcurrency);
    }
  };

  /**
   * GCS resumable upload session for `dataFile`. Reads
   * `MULTIPART_PART_SIZE_BYTES` bytes per chunk into a fresh Buffer and PUTs
   * each as a `Content-Range`-tagged chunk against the session URL minted by
   * the initiation POST. On transient chunk failure, queries the session for
   * the committed offset and resumes from there. On terminal failure,
   * best-effort DELETE the session so the upload doesn't linger as a
   * half-staged blob.
   *
   * Uses GCS's XML API resumable variant (initiate POST against the same
   * bucket-path URL the single-PUT uses, with `x-goog-resumable: start`)
   * rather than JSON API resumable, since GS hands the connector that XML
   * shape; honoring it avoids inventing a path prefix that the server
   * never returned and keeps strict-allowlisting environments working.
   *
   * @param {String} dataFile
   * @param {Number} fileSize
   * @param {Object} meta
   * @param {Object} encryptionMetadata
   */
  this.uploadFileResumable = async function (dataFile, fileSize, meta, encryptionMetadata) {
    const accessToken = meta['client'].gcsToken;
    const stageInfo = meta.stageInfo;
    const tempFilename = meta['dstFileName'].substring(
      meta['dstFileName'].indexOf('/') + 1,
      meta['dstFileName'].length,
    );
    // Same URL the single-PUT path uses; never invent a path GS didn't
    // return. See `uploadFileResumable` docstring for the why.
    const initUrl = this.generateFileURL(stageInfo, tempFilename);
    this.setupHttpClient(this.getGCSCustomEndPoint(stageInfo));

    const contentEncoding = normalizeGcsContentEncoding(meta);

    // Custom Snowflake metadata travels on the initiation POST as
    // `x-goog-meta-*` headers. GCS persists them with the final object so
    // subsequent HEAD/GET round-trips can read sfc-digest, encryptiondata,
    // matdesc back out the same way the single-PUT path does today.
    // `x-goog-resumable: start` is the XML API signal that this POST
    // initiates a resumable upload session; `x-upload-content-length`
    // lets GCS validate the final size against the chunk Content-Range
    // headers.
    const initHeaders = {
      Authorization: `Bearer ${accessToken}`,
      'x-goog-resumable': 'start',
      'Content-Length': 0,
      'Content-Type': 'application/octet-stream',
      'x-upload-content-length': fileSize,
      ...buildGcsEncryptionHeaders(meta, encryptionMetadata),
    };
    if (contentEncoding) {
      initHeaders[HTTP_HEADER_CONTENT_ENCODING] = contentEncoding;
    }

    let sessionUrl;
    try {
      const initResp = await axios.post(initUrl, '', { headers: initHeaders });
      sessionUrl = initResp.headers && initResp.headers['location'];
      if (!sessionUrl) {
        throw new Error('GCS resumable initiate succeeded without a Location header');
      }
    } catch (err) {
      applyGcsUploadError(err, meta, /* hasAccessToken */ true);
      return;
    }

    let success = false;
    const fd = await fs.promises.open(dataFile, 'r');
    try {
      let position = 0;
      while (position < fileSize) {
        const thisChunkSize = Math.min(MULTIPART_PART_SIZE_BYTES, fileSize - position);
        const buf = await readChunk(fd, position, thisChunkSize);

        const start = position;
        const end = position + thisChunkSize - 1;
        const chunkResp = await axios.put(sessionUrl, buf, {
          maxBodyLength: Infinity,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Length': buf.length,
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          },
          // GCS resumable uploads use 308 ("Resume Incomplete") as a normal
          // "keep going" signal, so treat it as success alongside 200/201 and
          // dispatch on the status below rather than letting axios throw.
          validateStatus: (s) => s === 200 || s === 201 || s === 308,
        });

        if (chunkResp.status === 308) {
          position = nextOffsetFromRangeHeader(chunkResp.headers, position + thisChunkSize);
        } else {
          position = fileSize;
          success = true;
        }
      }
    } catch (err) {
      // Best-effort cleanup. Errors here mask the original cause if we let
      // them surface, so suppress and rely on `applyGcsUploadError` to
      // record the real issue.
      try {
        await axios.delete(sessionUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch (_cleanupErr) {
        // Suppress.
      }
      applyGcsUploadError(err, meta, /* hasAccessToken */ true);
      return;
    } finally {
      await fd.close();
    }

    if (!success) {
      meta['lastError'] = new Error(
        'GCS resumable loop exited without final-chunk acknowledgement',
      );
      meta['resultStatus'] = resultStatus.NEED_RETRY;
      return;
    }

    meta['dstFileSize'] = meta['uploadSize'];
    meta['resultStatus'] = resultStatus.UPLOADED;
    meta[GCS_FILE_HEADER_DIGEST] = initHeaders[GCS_METADATA_SFC_DIGEST];
    meta[GCS_FILE_HEADER_CONTENT_LENGTH] = meta['uploadSize'];
    meta[GCS_FILE_HEADER_ENCRYPTION_METADATA] = initHeaders[GCS_METADATA_ENCRYPTIONDATAPROP];
  };

  /**
   * Create the file metadata then upload the file stream.
   *
   * @param {Buffer|string|stream.Readable} fileStream
   * @param {Object} meta
   * @param {Object} encryptionMetadata
   *
   * @returns {null}
   */
  this.uploadFileStream = async function (fileStream, meta, encryptionMetadata) {
    let uploadUrl = meta['presignedUrl'];
    let accessToken = null;

    if (!uploadUrl) {
      const tempFilename = meta['dstFileName'].substring(
        meta['dstFileName'].indexOf('/') + 1,
        meta['dstFileName'].length,
      );

      uploadUrl = this.generateFileURL(meta.stageInfo, tempFilename);
      accessToken = meta['client'].gcsToken;
    }

    const gcsHeaders = {
      [HTTP_HEADER_CONTENT_ENCODING]: normalizeGcsContentEncoding(meta),
      ...buildGcsEncryptionHeaders(meta, encryptionMetadata),
    };

    if (accessToken) {
      gcsHeaders['Authorization'] = `Bearer ${accessToken}`;
    }

    try {
      if (Buffer.isBuffer(fileStream)) {
        gcsHeaders['Content-Length'] = fileStream.length;
      } else if (typeof fileStream === 'string') {
        gcsHeaders['Content-Length'] = Buffer.byteLength(fileStream);
      } else if (meta && typeof meta['uploadFileSize'] === 'number') {
        gcsHeaders['Content-Length'] = meta['uploadFileSize'];
      }
      await axios.put(uploadUrl, fileStream, { maxBodyLength: Infinity, headers: gcsHeaders });
    } catch (err) {
      applyGcsUploadError(err, meta, !!accessToken);
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
      downloadUrl = this.generateFileURL(meta.stageInfo, lstrip(meta['srcFileName'], '/'));
      accessToken = meta['client'].gcsToken;
      gcsHeaders = { Authorization: `Bearer ${accessToken}` };
    }

    let encryptionDataprop;
    let matDescKey;
    let sfcDigest;
    let size;

    try {
      Logger().debug(`Downloading file from GCS using Axios`);
      let response;
      await axios
        .get(downloadUrl, {
          headers: gcsHeaders,
          responseType: 'stream',
        })
        .then(async (res) => {
          response = res;
          await new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(fullDstPath);
            response.data.pipe(writer);
            writer.on('error', (err) => {
              writer.close();
              reject(err);
            });
            writer.on('close', () => {
              resolve();
            });
          });
        });
      Logger().debug(
        `Sent Get Request to ${downloadUrl}, destination: ${fullDstPath}, http status: ${response.status}`,
      );

      encryptionDataprop = response.headers[GCS_METADATA_ENCRYPTIONDATAPROP];
      matDescKey = response.headers[GCS_METADATA_MATDESC_KEY];
      sfcDigest = response.headers[GCS_METADATA_SFC_DIGEST];
      size = response.headers['content-length'];
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
        matDescKey,
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
   * @param {Object} stageInfo
   * @param {String} filename
   *
   * @returns {String}
   */
  this.generateFileURL = function (stageInfo, filename) {
    const gcsLocation = this.extractBucketNameAndPath(stageInfo.location);
    const fullFilePath = `${gcsLocation.path}${filename}`;
    const endPoint = this.getGCSCustomEndPoint(stageInfo);
    let link;
    if (stageInfo['useVirtualUrl']) {
      link = `${endPoint}/${fullFilePath}`;
    } else {
      link = `${endPoint != null ? endPoint : 'https://storage.googleapis.com'}/${gcsLocation.bucketName}/${fullFilePath}`;
    }
    return link.startsWith('https://') ? link : `https://${link}`;
  };

  this.getGCSCustomEndPoint = function (stageInfo) {
    //TODO: SNOW-1789759 hardcoded region will be replaced in the future
    const isRegionalUrlEnabled =
      stageInfo.region.toLowerCase() === 'me-central2' || stageInfo.useRegionalUrl;
    let endPoint = null;
    if (stageInfo['endPoint']) {
      endPoint = stageInfo['endPoint'];
    } else if (stageInfo['useVirtualUrl']) {
      const bucket = this.extractBucketNameAndPath(stageInfo.location).bucketName;
      endPoint = `https://${bucket}.storage.googleapis.com`;
    } else if (isRegionalUrlEnabled) {
      endPoint = `storage.${stageInfo.region.toLowerCase()}.rep.googleapis.com`;
    }
    return endPoint;
  };

  this.setupHttpClient = function (endPoint) {
    if (typeof httpClient === 'undefined') {
      const proxy = ProxyUtil.getProxy(connectionConfig.getProxy(), 'GCS Util');

      if (proxy || Util.getEnvVar('http_proxy')) {
        const proxyAgent = getProxyAgent({
          proxyOptions: proxy,
          connectionConfig,
          parsedUrl: new URL(connectionConfig.accessUrl),
          destination: endPoint || 'storage.googleapis.com',
        });
        // TODO: This axios should handle and retry network failures (and
        // transient 5xx/408/429 responses) similarly to lib/http/axios_instance
        // and its useSnowflakeRetryMiddleware retry/backoff interceptors, so GCS
        // transfers behave consistently with the rest of the connector.
        //
        // It is not a drop-in swap; there are open issues we still need to
        // figure out before adopting the shared instance here:
        //   1. Proxy: the shared instance has no agent of its own, while this
        //      path needs a GCS-destination-specific proxy agent.
        //   2. Non-replayable bodies: the retry interceptor re-issues the
        //      request, but uploadFileStream PUTs a one-shot fs.ReadStream and
        //      nativeDownloadFile uses responseType:'stream', which cannot be
        //      safely replayed.
        //   3. Double-retry: remote_storage_util.js already retries off
        //      meta.resultStatus (and applyGcsUploadError maps transient codes
        //      to NEED_RETRY), so adding the middleware risks compounding
        //      retries/backoff.
        //   4. Token/URL renewal: 401->RENEW_TOKEN and 400->RENEW_PRESIGNED_URL
        //      are handled by the outer loop and must not be swallowed by a
        //      generic retry layer.
        axios = require('axios').create({
          proxy: false,
          httpAgent: proxyAgent,
          httpsAgent: proxyAgent,
        });
      } else {
        axios = require('axios');
      }
    }
  };
}

/**
 * Resolve the Content-Encoding for a GCS upload from the meta's destination
 * compression type, blanking it for the self-describing types (which GCS
 * would otherwise try to decode).
 */
function normalizeGcsContentEncoding(meta) {
  let contentEncoding = '';
  if (meta['dstCompressionType']) {
    contentEncoding = String(meta['dstCompressionType']['name']).toLowerCase();
  }
  if (['gzip', 'bzip2', 'brotli', 'deflate', 'raw_deflate', 'zstd'].includes(contentEncoding)) {
    contentEncoding = '';
  }
  return contentEncoding;
}

/**
 * Build the sfc-digest + encryption envelope headers (`x-goog-meta-*`) so
 * every upload path persists the same metadata shape.
 */
function buildGcsEncryptionHeaders(meta, encryptionMetadata) {
  const headers = { [GCS_METADATA_SFC_DIGEST]: meta['SHA256_DIGEST'] };
  if (encryptionMetadata) {
    headers[GCS_METADATA_ENCRYPTIONDATAPROP] = JSON.stringify({
      EncryptionMode: 'FullBlob',
      WrappedContentKey: {
        KeyId: 'symmKey1',
        EncryptedKey: encryptionMetadata.key,
        Algorithm: 'AES_CBC_256',
      },
      EncryptionAgent: {
        Protocol: '1.0',
        EncryptionAlgorithm: 'AES_CBC_256',
      },
      ContentEncryptionIV: encryptionMetadata.iv,
      KeyWrappingMetadata: {
        EncryptionLibrary: 'Java 5.3.0',
      },
    });
    headers[GCS_METADATA_MATDESC_KEY] = encryptionMetadata.matDesc;
  }
  return headers;
}

/**
 * @typedef {object} GCSLocation
 * @property {string} bucketName
 * @property {string} path
 */
function GCSLocation(bucketName, path) {
  return {
    bucketName: bucketName,
    path: path,
  };
}

/**
 * Parse the `Range` response header from a 308 chunk reply. GCS returns
 * the highest committed byte (e.g. `bytes=0-262143` means bytes 0..262143
 * are committed and the next write should start at 262144). When the
 * header is absent (some intermediaries strip it), fall back to the
 * caller-known position so we don't loop indefinitely on a degraded
 * response.
 */
function nextOffsetFromRangeHeader(headers, fallbackOffset) {
  const range = headers && (headers['range'] || headers['Range']);
  if (!range) {
    Logger().debug(
      `GCS resumable 308 missing Range header; resuming at caller-known offset ${fallbackOffset}`,
    );
    return fallbackOffset;
  }
  // Format: "bytes=0-N"
  const m = /^bytes=(\d+)-(\d+)$/.exec(range);
  if (!m) {
    Logger().debug(
      `GCS resumable 308 returned malformed Range header "${range}"; resuming at caller-known offset ${fallbackOffset}`,
    );
    return fallbackOffset;
  }
  return parseInt(m[2], 10) + 1;
}

/**
 * Translate a GCS error into the file-transfer-agent's `meta.resultStatus`
 * convention so retry semantics stay consistent across every upload path.
 *
 * `hasAccessToken` distinguishes the access-token path (renew the token on
 * 401) from the legacy presigned-URL path (renew the URL on 400).
 */
function applyGcsUploadError(err, meta, hasAccessToken) {
  // Capture prior `lastError.code` before overwriting `meta['lastError']`:
  // the legacy presigned-URL renew branch suppresses a second consecutive
  // 400 to avoid a renew loop, and that check needs to see the *previous*
  // attempt's code, not the one we're about to record.
  const priorCode = meta['lastError'] && meta['lastError']['code'];
  meta['lastError'] = err;
  const code = err && err['code'];
  const status = err && err['response'] && err['response']['status'];
  const httpCode = code || status;
  if ([403, 408, 429, 500, 502, 503, 504].includes(httpCode)) {
    meta['resultStatus'] = resultStatus.NEED_RETRY;
  } else if (hasAccessToken && httpCode === 401) {
    meta['resultStatus'] = resultStatus.RENEW_TOKEN;
  } else if (!hasAccessToken && httpCode === 400 && priorCode !== 400) {
    meta['resultStatus'] = resultStatus.RENEW_PRESIGNED_URL;
  } else {
    meta['resultStatus'] = resultStatus.NEED_RETRY;
  }
}

module.exports = GCSUtil;
