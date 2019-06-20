/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

var SimpleCache = require('simple-lru-cache');
var Errors = require('../errors');
var Util = require('../util');
var CertUtil = require('./cert_util');

/**
 * Client-side cache for storing OCSP responses.
 *
 * @param {Number} capacity
 * @param {Number} maxAge
 *
 * @constructor
 */
function OcspResponseCache(capacity, maxAge)
{
  // validate input
  Errors.assertInternal(Util.number.isPositiveInteger(capacity));
  Errors.assertInternal(Util.number.isPositiveInteger(maxAge));

  // create a cache to store the responses
  var cache = new SimpleCache({maxSize: capacity});

  /**
   * Adds an entry to the cache.
   *
   * @param cert
   * @param response
   */
  this.set = function set(cert, response)
  {
    // for the value, use an object that contains the response
    // as well as the time at which the response was saved
    cache.set(CertUtil.buildCertId(cert),
      {
        response: response,
        savedAt: Date.now()
      });
  };

  /**
   * Returns an entry from the cache.
   *
   * @param cert
   * @returns {*}
   */
  this.get = function get(cert)
  {
    // build the certificate id
    var certId = CertUtil.buildCertId(cert);

    // if we have an entry in the cache
    var value = cache.get(certId);
    if (value)
    {
      var response = value.response;
      var savedAt = value.savedAt;

      var now = Date.now();

      // if the cache entry has expired, or if the current time doesn't fall
      // within the response validity range, remove the entry from the cache
      if (((now - savedAt) > maxAge) ||
        (response.thisUpdate > now) || (response.nextUpdate < now))
      {
        cache.del(certId);
        response = null;
      }
    }

    return response;
  };
}

module.exports = OcspResponseCache;