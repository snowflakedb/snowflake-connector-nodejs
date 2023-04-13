/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
 */

const os = require('os');
const path = require('path');
const mkdirp = require('mkdirp');

const Util = require('./util');
const Errors = require('./errors');
const Logger = require('./logger');

let insecureConnect = false;

/**
 * Updates the value of the 'insecureConnect' parameter.
 *
 * @param {boolean} value
 */
exports.setInsecureConnect = function (value)
{
  // validate input
  Errors.assertInternal(Util.isBoolean(value));

  insecureConnect = value;
};

/**
 * Returns the value of the 'insecureConnect' parameter.
 *
 * @returns {boolean}
 */
exports.isInsecureConnect = function ()
{
  return insecureConnect;
};

let ocspFailOpen = true;
exports.ocspFailOpen = ocspFailOpen;

/**
 * Updates the value of the 'ocspFailOpen' parameter.
 *
 * @param {boolean} value
 */
exports.setOcspFailOpen = function (value)
{
  // validate input
  Errors.assertInternal(Util.isBoolean(value));

  ocspFailOpen = value;
};

const ocspModes = {
  FAIL_CLOSED: 'FAIL_CLOSED',
  FAIL_OPEN: 'FAIL_OPEN',
  INSECURE: 'INSECURE'
};
exports.ocspModes = ocspModes;

/**
 * Returns the OCSP mode
 *
 * @returns {string}
 */
exports.getOcspMode = function ()
{
  if (insecureConnect)
  {
    return ocspModes.INSECURE;
  }
  else if (!ocspFailOpen)
  {
    return ocspModes.FAIL_CLOSED;
  }
  return ocspModes.FAIL_OPEN;
};

/**
 * Returns the upper limit for number of entries we can have in the OCSP response cache.
 *
 * @returns {number}
 */
exports.getOcspResponseCacheSizeLimit = function ()
{
  return 1000;
};

/**
 * Returns the maximum time in seconds that entries can live in the OCSP
 * response cache.
 *
 * @returns {number}
 */
exports.getOcspResponseCacheMaxAge = function ()
{
  // 24 hours, in seconds
  // It was in millionseconds before but the timestamp we save in
  // cache file was in seconds. Compare that with max age in millionseconds
  // would makes the cache never expire.
  // change max age here because customer would have local cache file exist
  // already and we need to keep that valid with new version of the driver.
  // use small value for test only
  var maxage = Number(process.env.SF_OCSP_TEST_CACHE_MAXAGE) || 86400;
  if ((maxage > 86400) || (maxage <= 0))
  {
    maxage = 86400;
  }
  return maxage;
};

/**
 * Creates a cache directory.
 *
 * @returns {string}
 */
exports.mkdirCacheDir = function ()
{
  let cacheRootDir = process.env.SF_OCSP_RESPONSE_CACHE_DIR;
  if (!Util.exists(cacheRootDir))
  {
    cacheRootDir = os.homedir();
  }
  if (!Util.exists(cacheRootDir))
  {
    cacheRootDir = os.tmpdir(); // fallback to TMP if user home doesn't exist.
  }

  let cacheDir;
  const platform = os.platform();
  if (platform === 'darwin')
  {
    cacheDir = path.join(cacheRootDir, "Library", "Caches", "Snowflake");
  }
  else if (platform === 'win32')
  {
    cacheDir = path.join(cacheRootDir, "AppData", "Local", "Snowflake", "Caches");
  }
  else
  {
    // linux
    cacheDir = path.join(cacheRootDir, ".cache", "snowflake");
  }
  try
  {
    mkdirp.sync(cacheDir);
  }
  catch (e)
  {
    Logger.getInstance().debug("Failed to create a cache directory %s, err: %s", cacheDir, e);
  }
  return cacheDir;
};

const rest = {
  HTTPS_PORT: 443,
  HTTPS_PROTOCOL: 'https'
};
exports.rest = rest;
