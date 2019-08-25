/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

const Check = require('./check');
const Logger = require('../logger');
const GlobalConfig = require('../global_config');
const Parameters = require('../parameters');
const CertUtil = require('./cert_util');
const OcspResponseCache = require('./ocsp_response_cache');
const Errors = require('../errors');
const ErrorCodes = Errors.codes;

const REGEX_SNOWFLAKE_ENDPOINT = /.snowflakecomputing.com$/;

const ocspFailOpenWarning =
  'WARNING!!! using fail-open to connect. Driver is connecting to an HTTPS endpoint ' +
  'without OCSP based Certificated Revocation checking as it could not obtain a valid OCSP Response to use from ' +
  'the CA OCSP responder. Details:';

const rawOcspFlag =
  process.env.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED;

const variables = {
  SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED:
    !rawOcspFlag || rawOcspFlag && rawOcspFlag.toLowerCase() !== "false",
  OCSP_RESPONSE_CACHE: undefined
};

/**
 * Returns the ocsp response cache.
 *
 * @returns {*}
 */
function getOcspResponseCache()
{
  // initialize the ocsp response cache if needed
  if (!variables.OCSP_RESPONSE_CACHE)
  {
    variables.OCSP_RESPONSE_CACHE = new OcspResponseCache.OcspResponseCache();
  }

  return variables.OCSP_RESPONSE_CACHE;
}


exports.variables = variables;
/**
 * Secures a given TLSSocket by blocking all writes until the certificate
 * associated with the socket has been validated.
 *
 * @param {Object} socket
 * @param {String} host
 * @param {Object} mock
 *
 * @returns {Object}
 */
exports.secureSocket = function (socket, host, mock)
{
  // if ocsp validation is disabled for the given host, return the socket as is
  if (isOcspValidationDisabled(host))
  {
    Logger.getInstance().debug('OCSP validation disabled for %s', host);
    return socket;
  }

  const validate = function ()
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
      if (!socket.authorized)
      {
        return socket;
      }
      // use ocsp to make sure the entire certificate chain can be trusted
      const certChain = socket.ssl.getPeerCertificate(true);
      const vcc = mock ? mock.validateCertChain : validateCertChain;

      vcc(certChain, function (err)
      {
        getOcspResponseCache().resetCacheStatus();
        if (err)
        {
          // if there's an error, destroy the socket
          Logger.getInstance().error('OCSP validation failed: %s', err);
          return socket.destroy(err);
        }

        Logger.getInstance().trace('OCSP validation succeeded for %s', host);

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
  return GlobalConfig.isInsecureConnect() ||
    (Parameters.getValue(Parameters.names.JS_DRIVER_DISABLE_OCSP_FOR_NON_SF_ENDPOINTS) &&
      !REGEX_SNOWFLAKE_ENDPOINT.test(host));
}

/**
 * Is valid OCSP error for cache
 * @param err
 * @returns {boolean}
 */
function isValidOCSPError(err)
{
  return err && (err.code === ErrorCodes.ERR_OCSP_REVOKED ||
    err.code === ErrorCodes.ERR_OCSP_UNKNOWN);
}

/**
 * Return err if any valid error is found.
 * @param errors
 * @returns {null|*}
 */
function canEarlyExitForOCSP(errors)
{
  if (GlobalConfig.getOcspMode() === GlobalConfig.ocspModes.FAIL_CLOSED)
  {
    for (let errorIndex = 0, length = errors.length;
         errorIndex < length; errorIndex++)
    {
      // first error
      const err = errors[errorIndex];
      if (err)
      {
        return err.hasOwnProperty('err') ? err.err : err;
      }
    }
  }
  else
  {
    let anyRevoked = null;
    for (let errorIndex = 0, length = errors.length;
         errorIndex < length; errorIndex++)
    {
      // first error
      const err = errors[errorIndex];
      if (err && !isValidOCSPError(err))
      {
        // any of the errors is NOT good/revoked/unknown
        Logger.getInstance().info(ocspFailOpenWarning);
        return null;
      }
      else if (err && err.code === ErrorCodes.ERR_OCSP_REVOKED)
      {
        anyRevoked = err;
      }
    }
    return anyRevoked;
  }
}

exports.canEarlyExitForOCSP = canEarlyExitForOCSP;

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
  const eachCallback = function (certs, index)
  {
    let cert = certs[index];
    validateCert(cert, function (err, data)
    {
      completed++;
      errors[index] = err;
      if (err)
      {
        Logger.getInstance().debug(err);
      }

      // if we have an ocsp response, cache it
      if (data && (!data.err || isValidOCSPError(data.err)))
      {
        getOcspResponseCache().set(cert, data.res);
        if (data.err)
        {
          err = data.err;
          errors[index] = err;
        }
      }

      // if this is the last request to complete
      if (completed === certs.length)
      {
        const validError = canEarlyExitForOCSP(errors);
        cb(validError);
      }
    });
  };

  // fire off requests to validate all the certificates in the chain
  let completed = 0;
  for (let index = 0, length = certs.length; index < length; index++)
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
  function getOcspCache()
  {
    try
    {
      if (!getOcspResponseCache().downloadCache(getOcspResonseAndVerify))
      {
        setTimeout(getOcspCache, 10);
      }
    }
    catch (e)
    {
      process.nextTick(function ()
      {
        cb(e);
      });
    }
  }

  /**
   * Gets and Verifies OCSP Response
   * @param err {object}
   * @param useCacheServer {boolean}
   */
  function getOcspResonseAndVerify(err, useCacheServer)
  {
    if (!useCacheServer && !getOcspResponseCache().isDownloadFinished())
    {
      setTimeout(getOcspResonseAndVerify, 10); // ms
      return;
    }

    let decoded;
    try
    {
      decoded = CertUtil.decode(cert);
    }
    catch (e)
    {
      process.nextTick(function ()
      {
        cb(e);
      });
    }

    // if we already have an entry in the cache, use it
    let ocspResponse = getOcspResponseCache().get(cert);
    if (ocspResponse)
    {
      Logger.getInstance().trace(
        'Returning OCSP status for certificate %s from cache', cert.serialNumber);
      const status = CertUtil.verifyOCSPResponse(decoded.issuer, ocspResponse);
      if (!status.err)
      {
        // verification was success with the cache
        process.nextTick(function ()
        {
          cb(null, null)
        });
      }
      else
      {
        // verification was failure with the cache
        process.nextTick(function ()
        {
          cb(status.err, null)
        });
      }
    }
    else
    {
      if (useCacheServer)
      {
        process.nextTick(function ()
        {
          getOcspCache()
        });
      }
      else
      {
        Check(decoded, cb)
      }
    }
  }

  if (!variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED)
  {
    getOcspResponseCache().forceDownloadToFinish();
  }
  getOcspResonseAndVerify(null, variables.SF_OCSP_RESPONSE_CACHE_SERVER_ENABLED);
}
