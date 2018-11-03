/*
 * Copyright (c) 2015-2018 Snowflake Computing Inc. All rights reserved.
 */

var EventEmitter = require('events').EventEmitter;
var Util         = require('../util');
var Errors       = require('../errors');
var ErrorCodes   = Errors.codes;

/**
 * Creates a new instance of an S3Service.
 *
 * @param {Object} connectionConfig
 * @param {Object} httpClient
 * @constructor
 */
function S3Service(connectionConfig, httpClient)
{
  // validate input
  Errors.assertInternal(Util.isObject(connectionConfig));
  Errors.assertInternal(Util.isObject(httpClient));

  /**
   * Issues a request to get an object from S3.
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
      maxNumRetries = connectionConfig.getRetryS3MaxNumRetries();
    }
    Errors.assertInternal(Util.isNumber(maxNumRetries) && maxNumRetries >= 0);

    // invoked when the request completes
    var callback = function callback(err, response, body)
    {
      if (err)
      {
        // if we haven't exceeded the maximum number of retries yet and the
        // server came back with a retryable error code
        // Note: 403's are retried because of a bug in S3
        // https://aws.amazon.com/articles/1904 (Handling Errors)
        if ((numRetries < maxNumRetries) && response &&
            ((response.statusCode >= 500 && response.statusCode < 600) ||
            (response.statusCode === 403) || (response.statusCode === 408)))
        {
          // increment the number of retries
          numRetries++;

          // use exponential backoff with decorrelated jitter to compute the
          // next sleep time:
          //   sleep = min(cap, random_between(base, sleep * 3))
          // for more details, check out:
          // http://www.awsarchitectureblog.com/2015/03/backoff.html
          var base = 1, cap = connectionConfig.getRetryS3MaxSleepTime();
          sleep = Math.min(cap, Math.abs(sleep * 3 - base) * Math.random() +
              Math.min(base, sleep * 3));

          // wait the appropriate amount of time before retrying the request
          setTimeout(sendRequest, sleep * 1000);
        }
        else
        {
          // wrap the error into a network error
          err = Errors.createNetworkError(
              ErrorCodes.ERR_S3_NETWORK_COULD_NOT_CONNECT, err);
        }
      }
      // if the response contains xml, build an S3 error from the response
      else if (response.getResponseHeader('Content-Type') ===
          'application/xml')
      {
        err = Errors.createS3Error(
            ErrorCodes.ERR_S3_RESPONSE_FAILURE, response);
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
      // issue a request to get the object from S3
      httpClient.request(
      {
        method   : 'GET',
        url      : options.url,
        headers  : options.headers,
        gzip     : true, // gunzip the response
        appendRequestId : false,
        callback : callback
      });
    };

    sendRequest();
  };
}

Util.inherits(S3Service, EventEmitter);

module.exports = S3Service;