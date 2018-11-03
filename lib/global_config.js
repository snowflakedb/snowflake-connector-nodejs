/*
 * Copyright (c) 2015-2018 Snowflake Computing Inc. All rights reserved.
 */

var Util   = require('./util');
var Errors = require('./errors');

var insecureConnect = false;

/**
 * Updates the value of the 'insecureConnect' parameter.
 *
 * @param {boolean} value
 */
exports.setInsecureConnect = function(value)
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
exports.isInsecureConnect = function()
{
  return insecureConnect;
};

/**
 * Returns the maximum number of entries we can have in the OCSP response cache.
 *
 * @returns {number}
 */
exports.getOcspResponseCacheMaxSize = function()
{
  return 100;
};

/**
 * Returns the maximum time in milliseconds that entries can live in the OCSP
 * response cache.
 *
 * @returns {number}
 */
exports.getOcspResponseCacheMaxAge = function()
{
  return 86400000; // 24 hours
};