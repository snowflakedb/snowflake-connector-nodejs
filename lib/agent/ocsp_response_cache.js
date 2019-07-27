/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const SimpleCache = require('simple-lru-cache');
const Errors = require('../errors');
const ErrorCodes = Errors.codes;
const Util = require('../util');
const CertUtil = require('./cert_util');
const GlobalConfig = require('../global_config');
const Logger = require('../logger');

const OCSP_URL = 'http://ocsp.snowflakecomputing.com/ocsp_response_cache.json';
const status = {
  NOT_START: 'not_start',
  STARTED: 'started',
  FINISHED: 'finish',
};

/**
 * Cache for storing OCSP responses. This covers both client and server caches.
 *
 * @constructor
 */
function OcspResponseCache()
{
  let downloadStatus = status.NOT_START;
  let cacheUpdated = false;

  // validate input
  const capacity = GlobalConfig.getOcspResponseCacheMaxSize();
  const maxAge = GlobalConfig.getOcspResponseCacheMaxAge();

  Errors.assertInternal(Util.number.isPositiveInteger(capacity));
  Errors.assertInternal(Util.number.isPositiveInteger(maxAge));

  // create a cache to store the responses
  const cache = new SimpleCache({maxSize: capacity});

  /**
   * Reads OCSP cache file.
   */
  const cacheDir = GlobalConfig.mkdirCacheDir();
  const cacheFileName = path.join(cacheDir, "ocsp_response_cache.json");
  exports.cacheFileName = cacheFileName;

  const currentTime = Date.now() / 1000;
  try
  {
    Logger.getInstance().debug("Reading OCSP cache file. %s", cacheFileName);
    const contents = fs.readFileSync(cacheFileName, 'utf-8');
    let jsonParsed = JSON.parse(contents);
    for (let entry in jsonParsed)
    {
      if (jsonParsed.hasOwnProperty(entry))
      {
        const status = validateCacheEntry(entry, jsonParsed[entry]);
        if (!status.err)
        {
          cache.set(status.key, status.value);
        }
      }
    }
  }
  catch (e)
  {
    Logger.getInstance().debug("Failed to read OCSP cache file: %s, err: %s", cacheFileName, e);
  }

  /**
   * Is OCSP Cache download finished?
   * @returns {boolean}
   */
  this.isDownloadFinished = function ()
  {
    return downloadStatus === status.FINISHED;
  };

  /**
   * Forces download status to finish
   */
  this.forceDownloadToFinish = function ()
  {
    downloadStatus = status.FINISHED;
  }

  /**
   * Resets OCSP Cache status
   */
  this.resetCacheStatus = function ()
  {
    downloadStatus = status.NOT_START;
    if (cacheUpdated)
    {
      Logger.getInstance().debug(cacheFileName);

      const currentTime = Date.now() / 1000;
      const cacheOutput = {};
      cache.forEach(function (v, k)
      {
        const certIdInBase64 = CertUtil.decodeKey(k);
        const ocspResponseInBase64 = v.toString("BASE64");
        cacheOutput[certIdInBase64] = [currentTime, ocspResponseInBase64];
      });
      const writeContent = JSON.stringify(cacheOutput);
      Logger.getInstance().debug("Writing OCSP cache file. %s", cacheFileName);
      try
      {
        fs.writeFileSync(cacheFileName, writeContent, 'utf-8');
      }
      catch (e)
      {
        Logger.getInstance().debug("Failed to update OCSP cache file: %s, err: %s", cacheFileName, e);
      }
      cacheUpdated = false;
    }
  };

  /**
   * Adds an entry to the cache.
   *
   * @param cert
   * @param response
   */
  this.set = function set(cert, response)
  {
    const certId = CertUtil.buildCertId(cert);
    cache.set(certId, response);
    cacheUpdated = true;
  };

  /**
   * Returns an entry from the cache.
   *
   * @param cert
   * @returns {*}
   */
  this.get = function get(cert)
  {
    const certId = CertUtil.buildCertId(cert);
    return cache.get(certId);
  };

  /**
   * Downloads OCSP cache from the Snowflake OCSP cache server.
   * @param cb callback
   */
  this.downloadCache = function (cb)
  {
    if (downloadStatus === status.STARTED)
    {
      // reschedule calling cb
      return false;
    }
    else if (downloadStatus === status.FINISHED)
    {
      // call cb immediately
      cb(null, false);
      return true;
    }
    downloadStatus = status.STARTED;

    function checkOCSPResponse(err, cacheContent)
    {
      downloadStatus = status.FINISHED;
      if (err)
      {
        Logger.getInstance()
          .debug("Failed to download OCSP cache file. %s. Ignored", err);
        return cb(err, false);
      }
      try
      {
        let jsonParsed = JSON.parse(cacheContent);
        for (let entry in jsonParsed)
        {
          if (jsonParsed.hasOwnProperty(entry))
          {
            const status = validateCacheEntry(entry, jsonParsed[entry]);
            if (!status.err)
            {
              cache.set(status.key, status.value);
            }
          }
        }
        cacheUpdated = true;
        return cb(null, false);
      }
      catch (e)
      {
        cb(err, false);
      }
    }

    function onResponse(response)
    {
      if (response.statusCode < 200 || response.statusCode >= 400)
      {
        return checkOCSPResponse(
          new Error('Failed to obtain OCSP response: ' +
            response.statusCode), null);
      }

      let rawData = '';

      // A chunk of data has been received.
      response.on('data', function (chunk)
      {
        rawData += chunk;
      });

      // The whole response has been received. Print out the result.
      response.on('end', function ()
      {
        checkOCSPResponse(null, rawData)
      });
    }

    http.get(OCSP_URL, onResponse).on('error', checkOCSPResponse);
    return true;
  };

  /**
   * Deletes the OCSP cache
   */
  this.deleteCache = function ()
  {
    try
    {
      cache.reset();
      fs.unlinkSync(cacheFileName);
    }
    catch (e)
    {
      Logger.getInstance()
        .debug("Failed to delete OCSP cache file: %s, err: %s", cacheFileName, e);
    }
  };

  /**
   * Validate cache entry
   * @param certIdBase64 cache key
   * @param ocspResponseBase64 cache value
   * @returns {Object}
   */
  function validateCacheEntry(certIdBase64, ocspResponseBase64)
  {
    const maxAge = GlobalConfig.getOcspResponseCacheMaxAge();

    if (ocspResponseBase64.length !== 2)
    {
      Logger.getInstance()
        .debug("OCSP cache value doesn't consist of two elements. Ignored.");
      return {err: Errors.createOCSPError(ErrorCodes.ERR_OCSP_NOT_TWO_ELEMENTS)};
    }
    if ((currentTime - ocspResponseBase64[0]) > maxAge)
    {
      Logger.getInstance().debug(
        "OCSP cache validity is out of range. currentTime: %s, timestamp: %s",
        currentTime, ocspResponseBase64[0]);
      return {err: Errors.createOCSPError(ErrorCodes.ERR_OCSP_CACHE_EXPIRED)};
    }
    try
    {
      const k = CertUtil.encodeKey(certIdBase64);
      const rawOCSPResponse = Buffer.from(ocspResponseBase64[1], 'base64');
      const status = CertUtil.verifyOCSPResponse(null, rawOCSPResponse);
      if (!status.err)
      {
        return {err: null, key: k, value: rawOCSPResponse};
      }
      return {err: status.err};
    }
    catch (e)
    {
      Logger.getInstance()
        .debug("Failed to parse OCSP response. %s. Ignored.", e);
      return {err: Errors.createOCSPError(ErrorCodes.ERR_OCSP_FAILED_PARSE_RESPONSE)};
    }
  }
}

module.exports = OcspResponseCache;