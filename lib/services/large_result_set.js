/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

var EventEmitter = require('events').EventEmitter;
var Util = require('../util');
var Errors = require('../errors');
var ErrorCodes = Errors.codes;

/**
 * Creates a new instance of an LargeResultSetService.
 *
 * @param {Object} connectionConfig
 * @param {Object} httpClient
 * @constructor
 */
function LargeResultSetService(connectionConfig, httpClient)
{
  // validate input
  Errors.assertInternal(Util.isObject(connectionConfig));
  Errors.assertInternal(Util.isObject(httpClient));

  function isRetryableError(response, err)
  {
    // https://aws.amazon.com/articles/1904 (Handling Errors)
    // Note: 403's are retried because of a bug in S3/Blob
    return Util.isRetryableHttpError(
      response, true // retry HTTP 403
    ) || err && (err.code === "ECONNRESET" || err.code === 'ETIMEDOUT');
  }

  /**
   * Issues a request to get an object from S3/Blob.
   *
   * @param {Object} options
   */
  this.getObject = function getObject(options)
  {
    var numRetries = 0, sleep = 1;

    // get the maximum number of retries
    var maxNumRetries = options.maxNumRetries;
    if (!Util.exists(maxNumRetries))
    {
      maxNumRetries = connectionConfig.getRetryLargeResultSetMaxNumRetries();
    }
    Errors.assertInternal(Util.isNumber(maxNumRetries) && maxNumRetries >= 0);

    // invoked when the request completes
    var callback = function callback(err, response, body)
    {
      if (err)
      {
        // if we haven't exceeded the maximum number of retries yet and the
        // server came back with a retryable error code.
        if (numRetries < maxNumRetries && isRetryableError(response, err))
        {
          // increment the number of retries
          numRetries++;

          // use exponential backoff with decorrelated jitter to compute the
          // next sleep time:
          var cap = connectionConfig.getRetryLargeResultSetMaxSleepTime();
          sleep = Util.nextSleepTime(1, cap, sleep);

          // wait the appropriate amount of time before retrying the request
          setTimeout(sendRequest, sleep * 1000);
        }
        else
        {
          // wrap the error into a network error
          err = Errors.createNetworkError(
            ErrorCodes.ERR_LARGE_RESULT_SET_NETWORK_COULD_NOT_CONNECT, err);
        }
      }
      // if the response contains xml, build an S3/Blob error from the response
      else if (response.getResponseHeader('Content-Type') ===
        'application/xml')
      {
        err = Errors.createLargeResultSetError(
          ErrorCodes.ERR_LARGE_RESULT_SET_RESPONSE_FAILURE, response);
      }

      // if we have an error, clear the body
      if (err)
      {
        body = null;
      }

      // if a callback was specified, invoke it
      if (Util.isFunction(options.callback))
      {
        options.callback(err, body);
      }
    };

    var sendRequest = function sendRequest()
    {
      // issue a request to get the object from S3/Blob
      httpClient.request(
        {
          method: 'GET',
          url: options.url,
          headers: options.headers,
          gzip: true, // gunzip the response
          appendRequestId: false,
          callback: callback
        });
    };

    sendRequest();
  };
}

Util.inherits(LargeResultSetService, EventEmitter);

module.exports = LargeResultSetService;
