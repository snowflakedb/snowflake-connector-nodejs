/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

const zlib = require('zlib');
const Util = require('../util');
const Errors = require('../errors');
const Logger = require('../logger');

const DEFAULT_REQUEST_TIMEOUT = 60000;

/**
 * Creates a new HTTP client.
 *
 * @param connectionConfig
 * @constructor
 */
function HttpClient(connectionConfig)
{
  // save the connection config
  this._connectionConfig = connectionConfig;

  // check that we have a valid request module
  var requestModule = this.getRequestModule();
  Errors.assertInternal(
    Util.isObject(requestModule) || Util.isFunction(requestModule));
}

HttpClient.prototype.getConnectionConfig = function ()
{
  return this._connectionConfig;
};

/**
 * Issues an HTTP request.
 *
 * @param {Object} options
 *
 * @returns {Object} an object representing the request that was issued.
 */
HttpClient.prototype.request = function (options)
{
  // validate input
  Errors.assertInternal(Util.isObject(options));
  Errors.assertInternal(Util.isString(options.method));
  Errors.assertInternal(Util.isString(options.url));
  Errors.assertInternal(!Util.exists(options.headers) ||
    Util.isObject(options.headers));
  Errors.assertInternal(!Util.exists(options.json) ||
    Util.isObject(options.json));
  Errors.assertInternal(!Util.exists(options.callback) ||
    Util.isFunction(options.callback));

  var headers;
  var json;
  var body;
  var request;

  // normalize the headers
  headers = normalizeHeaders(options.headers);

  // create a function to send the request
  var sendRequest = function sendRequest()
  {
    var url = options.url;

    Logger.getInstance().trace(url);

    // build the basic request options
    var requestOptions =
      {
        method: options.method,
        url: url,
        headers: headers,
        gzip: options.gzip,
        json: json,
        body: body,
        timeout: options.timeout ||
          this._connectionConfig.getTimeout() ||
          DEFAULT_REQUEST_TIMEOUT,
        requestOCSP: true,
        rejectUnauthorized: true
      };

    let mock;
    if (this._connectionConfig.agentClass)
    {
      mock = {
        agentClass: this._connectionConfig.agentClass
      }
    }

    // add the agent and proxy options
    const agentAndProxyOptions = this.getAgentAndProxyOptions(
      url, this._connectionConfig.getProxy(),
      mock);
    requestOptions = Util.apply(requestOptions, agentAndProxyOptions);

    // issue the request
    request = this.getRequestModule()(
      requestOptions, function (err, response, body)
      {
        // if a callback has been specified, normalize the
        // response before passing it to the callback
        if (Util.isFunction(options.callback))
        {
          options.callback(err, normalizeResponse(response), body);
        }
      });
  };
  sendRequest = sendRequest.bind(this);

  // if a request body is specified and compression is enabled,
  // try to compress the request body before sending the request
  json = body = options.json;
  if (body)
  {
    var bufferUncompressed = Buffer.from(JSON.stringify(body), 'utf8');
    zlib.gzip(bufferUncompressed, null, function (err, bufferCompressed)
    {
      // if the compression was successful
      if (!err)
      {
        json = undefined; // don't specify the 'json' option

        // use the compressed buffer as the body and
        // set the appropriate content encoding
        body = bufferCompressed;
        headers['Content-Encoding'] = 'gzip';
      }
      else
      {
        Logger.getInstance().warn('Could not compress request body.');
      }

      sendRequest();
    });
  }
  else
  {
    if (body)
    {
      Logger.getInstance().trace('Request body compression disabled.');
    }

    process.nextTick(sendRequest);
  }

  // return an externalized request object that only contains
  // methods we're comfortable exposing to the outside world
  return {
    abort: function ()
    {
      if (request)
      {
        request.abort();
      }
    }
  };
};

/**
 * @abstract
 * Returns the module to use when making HTTP requests. Subclasses must override
 * and provide their own implementations.
 *
 * @returns {*}
 */
HttpClient.prototype.getRequestModule = function ()
{
  return null;
};

/**
 * Returns the agent and proxy options.
 *
 * @param {String} url
 * @param {Object} proxy
 *
 * @returns {*}
 */
HttpClient.prototype.getAgentAndProxyOptions = function (url, proxy, mock)
{
  return null;
};

module.exports = HttpClient;

/**
 * Normalizes a request headers object so that we get the same behavior
 * regardless of whether we're using request.js or browser-request.js.
 *
 * @param {Object} headers
 *
 * @returns {Object}
 */
function normalizeHeaders(headers)
{
  var ret = headers;

  if (Util.isObject(headers))
  {
    ret = {
      'user-agent': Util.userAgent
    };

    // shallow copy the headers object and convert some headers like 'Accept'
    // and 'Content-Type' to lower case while copying; this is necessary
    // because the browser-request module, which we use to make http requests in
    // the browser, does not do case-insensitive checks when deciding whether to
    // insert default values for the 'accept' and 'content-type' headers; in
    // otherwise, if someone specifies an 'Accept': 'application/json' header,
    // browser-request will inject its own 'accept': 'application/json' header
    // and the browser XMLHttpRequest object will concatenate the two values and
    // send 'Accept': 'application/json, application/json' with the request
    var headerNameLowerCase;
    for (var headerName in headers)
    {
      if (headers.hasOwnProperty(headerName))
      {
        headerNameLowerCase = headerName.toLowerCase();
        if ((headerNameLowerCase === 'accept') ||
          (headerNameLowerCase === 'content-type'))
        {
          ret[headerNameLowerCase] = headers[headerName];
        }
        else
        {
          ret[headerName] = headers[headerName];
        }
      }
    }
  }

  return ret;
}

/**
 * Normalizes the response object so that we can extract response headers from
 * it in a uniform way regardless of whether we're using request.js or
 * browser-request.js.
 *
 * @param {Object} response
 *
 * @return {Object}
 */
function normalizeResponse(response)
{
  // if the response doesn't already have a getResponseHeader() method, add one
  if (response && !response.getResponseHeader)
  {
    response.getResponseHeader = function (header)
    {
      return response.headers && response.headers[
        Util.isString(header) ? header.toLowerCase() : header];
    };
  }

  return response;
}