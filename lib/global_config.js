/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
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
 * Returns the maximum number of entries we can have in the OCSP response cache.
 *
 * @returns {number}
 */
exports.getOcspResponseCacheMaxSize = function ()
{
  return 100;
};

/**
 * Returns the maximum time in milliseconds that entries can live in the OCSP
 * response cache.
 *
 * @returns {number}
 */
exports.getOcspResponseCacheMaxAge = function ()
{
  return 86400000; // 24 hours
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
