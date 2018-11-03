/*
 * Copyright (c) 2015-2018 Snowflake Computing Inc. All rights reserved.
 */

var check             = require('./check');
var Logger            = require('../logger');
var GlobalConfig      = require('../global_config');
var Parameters        = require('../parameters');
var CertUtil          = require('./cert_util');
var OcspResponseCache = require('./ocsp_response_cache');

var REGEX_SNOWFLAKE_ENDPOINT = /.snowflakecomputing.com$/;

/**
 * Secures a given TLSSocket by blocking all writes until the certificate
 * associated with the socket has been validated.
 *
 * @param {Socket} socket
 * @param {String} host
 *
 * @returns {Socket}
 */
exports.secureSocket = function(socket, host)
{
  // if ocsp validation is disabled for the given host, return the socket as is
  if (isOcspValidationDisabled(host))
  {
    Logger.getInstance().debug('OCSP validation disabled for %s', host);
    return socket;
  }

  var validate = function validate()
  {
    // stop listening for the secure event
    socket.removeListener('secure', validate);

    // if the server has resumed our existing session, unblock all
    // writes without performing any additional validation
    if (socket.isSessionReused())
    {
      socket.uncork();
    }
    else
    {
      // use ocsp to make sure the entire certificate chain can be trusted
      var certChain = socket.ssl.getPeerCertificate(true);
      validateCertChain(certChain, function(err)
      {
        // if there's an error, destroy the socket
        if (err)
        {
          Logger.getInstance().error('OCSP validation failed: %s', err);
          return socket.destroy(err);
        }

        Logger.getInstance().trace(
            'OCSP validation succeeded for %s', host);

        // unblock all writes
        socket.uncork();
      });
    }

    Logger.getInstance().trace('socket reused = %s', socket.isSessionReused());
  };

  // when the socket is secure, perform additional validation
  socket.on('secure', validate);

  // block all writes until validation is complete
  socket.cork();

  return socket;
};

/**
 * Determines if ocsp validation is disabled for a given host.
 *
 * @param {String} host
 * @returns {boolean}
 */
function isOcspValidationDisabled(host)
{
  // ocsp is disabled if insecure-connect is enabled, or if we've disabled ocsp
  // for non-snowflake endpoints and the host is a non-snowflake endpoint
  return GlobalConfig.isInsecureConnect() || (Parameters.getValue(
          Parameters.names.JS_DRIVER_DISABLE_OCSP_FOR_NON_SF_ENDPOINTS) &&
      !REGEX_SNOWFLAKE_ENDPOINT.test(host));
}

var ocspResponseCache;

/**
 * Returns the ocsp response cache.
 *
 * @returns {*}
 */
function getOcspResponseCache()
{
  // initialize the ocsp response cache if needed
  if (!ocspResponseCache)
  {
    ocspResponseCache = new OcspResponseCache(
        GlobalConfig.getOcspResponseCacheMaxSize(),
        GlobalConfig.getOcspResponseCacheMaxAge());
  }

  return ocspResponseCache;
}

/**
 * Validates a certificate chain using OCSP.
 *
 * @param {Object} cert a top-level cert that represents the leaf of a
 *   certificate chain.
 * @param {Function} cb the callback to invoke once the validation is complete.
 */
function validateCertChain(cert, cb)
{
  // walk up the certificate chain and collect all the certificates in an array
  var certs = [];
  while (cert && cert.issuerCertificate &&
  (cert.fingerprint !== cert.issuerCertificate.fingerprint))
  {
    certs.push(cert);
    cert = cert.issuerCertificate;
  }

  // create an array to store any errors encountered
  // while validating the certificate chain
  var errors = new Array(certs.length);

  /**
   * Called for every certificate as we traverse the certificate chain and
   * validate each one.
   *
   * @param certs
   * @param index
   */
  var eachCallback = function(certs, index)
  {
    var cert = certs[index];
    validateCert(cert, function(err, data)
    {
      completed++;
      errors[index] = err;

      // if we have an ocsp response, cache it
      if (data)
      {
        getOcspResponseCache().set(cert, data);
      }

      // if this is the last request to complete
      if (completed === certs.length)
      {
        // if we saw one or more errors, invoke the callback with the first
        // error we saw; otherwise invoke the callback without any error
        for (var errorIndex = 0, length = errors.length;
             errorIndex < length; errorIndex++)
        {
          var error = errors[errorIndex];
          if (error)
          {
            break;
          }
        }
        cb(error);
      }
    });
  };

  // fire off requests to validate all the certificates in the chain
  var completed = 0;
  for (var index = 0, length = certs.length; index < length; index++)
  {
    eachCallback(certs, index);
  }
}

/**
 * Validates a certificate using OCSP.
 *
 * @param cert the certificate to validate.
 * @param cb the callback to invoke once the validation is complete.
 */
function validateCert(cert, cb)
{
  // if we already have an entry in the cache, use it
  var ocspResponse = getOcspResponseCache().get(cert);
  if (ocspResponse)
  {
    process.nextTick(function()
    {
      Logger.getInstance().trace('Returning OCSP status for certificate %s ' +
          'from cache', cert.serialNumber);

      cb(null, ocspResponse);
    });
  }
  else
  {
    try
    {
      var decoded = CertUtil.decode(cert);
    }
    catch(e)
    {
      process.nextTick(function()
      {
        cb(e);
      });
    }

    // issue a request to get the ocsp status
    check(decoded, cb);
  }
}