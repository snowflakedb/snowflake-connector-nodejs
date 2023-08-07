/*
 * Copyright (c) 2015-2021 Snowflake Computing Inc. All rights reserved.
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
  'the CA OCSP responder. Details: ';

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
exports.secureSocket = function ( socket, host, agent, mock)
{
  console.log(`Securing socket ${JSON.stringify(socket)}`)
  console.log(`Securing socket is authorized ${socket.authorized}`)
  // if ocsp validation is disabled for the given host, return the socket as is
  if (isOcspValidationDisabled(host))
  {
    Logger.getInstance().debug('OCSP validation disabled for %s', host);
    return socket;
  }

  if (agent != null)
  {
    getOcspResponseCache().setAgent(agent);
  }

  let socketError;
  const validate = function ()
  {
    console.log('RUNNING VALIDATE...')
    // stop listening for the secure event
    socket.removeListener('secure', validate);

    // if the server has resumed our existing session, unblock all
    // writes without performing any additional validation
    // TODO SNOW-876346 isSessionReused working even ocsp verification wasn't done on that socket.
    //  To optymalize the condition shoulde be sure about socket is verified.
    Logger.getInstance().error(`Socket (before checking reused) is destroyed? ${socket.destroyed}`)
    if (socket.isSessionReused())
    {
      console.log('SESSION REUSED');
      socket.uncork();
    }
    else
    {
      if (!socket.authorized)
      {
        console.log('SOCKET NOT AUTHORIZED');
        return socket;
      }
      // use ocsp to make sure the entire certificate chain can be trusted
      // TODO SNOW-876346 - If we haven't got cert or was exception during get request should be finished with error.
      //  I don't now how successfully return error. Neither `socket.destroy(err)` nor `socket.emit('error', er)`
      //  works as expected - httpClient doesn't reject request.
      let certChain;
      try {
        certChain = socket.ssl.getPeerCertificate(true);
        if(!certChain){
          console.log('Undefined cert chain')
          // socket.emit('error', Errors.createOCSPError(ErrorCodes.ERR_OCSP_UNKNOWN))
          const error = Errors.createOCSPError(ErrorCodes.ERR_OCSP_UNKNOWN);
          socketError = error;
          return socket.destroy(error);
        }
      } catch (e) {
        // socket.emit('error', Errors.createOCSPError(ErrorCodes.ERR_OCSP_UNKNOWN))
        const error = Errors.createOCSPError(ErrorCodes.ERR_OCSP_UNKNOWN);
        socketError = error;
        return socket.destroy(error);
      }

      const vcc = mock ? mock.validateCertChain : validateCertChain;

      vcc(certChain, function (err) {
        getOcspResponseCache().resetCacheStatus();
        if (err) {
          // if there's an error, destroy the socket
          Logger.getInstance().error('OCSP validation failed: %s', err);
          const destroyedSocket = socket.destroy(err);
          console.log('Destroyed socket');
          socketError = err;
          return destroyedSocket;
          // throw new Error(`Socket should be destroyed because of ${err}`);
        }

        Logger.getInstance().trace('OCSP validation succeeded for %s', host);

        // unblock all writes
        socket.uncork();
      });
    }

    Logger.getInstance().trace('socket reused = %s', socket.isSessionReused());
  };

  if(socket.authorized){
    console.log('Socket is authorized')
    socket.cork();
    validate();
    return {
      socket,
      socketError,
    };
  } else {
    console.log('Socket is unauthorized')
    // when the socket is secure, perform additional validation
    socket.on('secure', validate);

    // block all writes until validation is complete
    socket.cork();

    console.log(`Returning socket in state destroyed: ${socket.destroyed}`);
    return socket;
  }
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
        Logger.getInstance().warn(ocspFailOpenWarning + err);
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
  console.log(`validateCertChain `)
  // walk up the certificate chain and collect all the certificates in an array
  var certs = [];
  while (cert && cert.issuerCertificate &&
  (cert.fingerprint !== cert.issuerCertificate.fingerprint))
  {
    certs.push(cert);
    cert = cert.issuerCertificate;
  }

  if (certs.length === 0){
    console.log('Undefined cert chain')
    cb(Errors.createOCSPError(ErrorCodes.ERR_OCSP_FAILED_OBTAIN_OCSP_RESPONSE))
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
        // check if cache is initialized before setting entry
        if (getOcspResponseCache().isInitialized())
        {
          getOcspResponseCache().set(cert, data.res);
        } else {
          getOcspResponseCache().initCache(cert, data.res);
        }
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
  if (certs.length !== 0) {
    for (let index = 0, length = certs.length; index < length; index++) {
      eachCallback(certs, index);
    }
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

    let ocspResponse;
    // check if cache is initialized before getting entry
    if (getOcspResponseCache().isInitialized())
    {
      if (getOcspResponseCache().IsCacheExpired())
      {
        // reset cache status so it can be refreshed
        getOcspResponseCache().resetCacheStatus();
      }
      else
      {
        // if we already have a valid entry in the cache, use it
        ocspResponse = getOcspResponseCache().get(cert);
      }
    }
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
