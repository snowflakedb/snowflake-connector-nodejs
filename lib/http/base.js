/*
 * Copyright (c) 2015-2019 Snowflake Computing Inc. All rights reserved.
 */

const zlib = require('zlib');
const Util = require('../util');
const Errors = require('../errors');
const Logger = require('../logger');
const axios = require('axios');

const DEFAULT_REQUEST_TIMEOUT = 360000;

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
  var sendRequest = async function sendRequest()
  {
    const url = options.url;

    const timeout = options.timeout ||
      this._connectionConfig.getTimeout() ||
      DEFAULT_REQUEST_TIMEOUT;

    Logger.getInstance().trace(`CALL ${options.method} with timeout ${timeout}: ${url}`);
    // build the basic request options

    var requestOptions =
      {
        method: options.method,
        url: url,
        headers: headers,
        gzip: options.gzip,
        json: json,
        body: body,
        timeout: timeout,
        requestOCSP: true,
        rejectUnauthorized: true,
        // axios does not know how to decode response with content-encoding GZIP (it should be gzip)
        // that we receive from GCS, so let's get response as arraybuffer and unzip it outside axios
        // issue in axios about case insensitive content-encoding is marked as won't fix: https://github.com/axios/axios/issues/4280
        // for all other responses we manually parse jsons or other structures from the server so they need to be text
        // TODO SNOW-917244 we can get rid of this logic when axios > 1.5.0 will be release as it should contain fix https://github.com/axios/axios/issues/5890
        responseType: options.url.includes('storage.googleapis.com') ? 'arraybuffer' : 'text',
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

    requestOptions.data = requestOptions.body;
    requestOptions.httpsAgent = agentAndProxyOptions.agentClass(agentAndProxyOptions.agentOptions);
    requestOptions.httpsAgent.keepAlive = agentAndProxyOptions.agentOptions.keepAlive;
    requestOptions.retryDelay = this.constructExponentialBackoffStrategy();

    request = axios.request(requestOptions).then(response => {
      if (Util.isFunction(options.callback)) {
        if (options.url.includes('storage.googleapis.com')) {
          // we request that GCS returns body as arraybuffer, not text
          // when it is GZIPped then we have to unzip it
          // otherwise we should convert arraybuffer to string
          // TODO SNOW-917244 we can get rid of this logic when axios > 1.5.0 will be release as it should contain fix https://github.com/axios/axios/issues/5890
          try {
            if (response.headers['content-encoding'] === 'GZIP') {
              const unzippedData = zlib.gunzipSync(response.data).toString('utf-8');
              return options.callback(null, normalizeResponse(response), unzippedData);
            } else {
              return options.callback(null, normalizeResponse(response), new TextDecoder('utf-8').decode(response.data));
            }
          } catch (e) {
            return options.callback(e, null, null);
          }
        } else {
          return options.callback(null, normalizeResponse(response), response.data);
        }
      } else {
        Logger.getInstance().trace(`Callback function was not provided for the call to ${options.url}`);
        return null;
      }
    }).catch(err => {
      if (Util.isFunction(options.callback)) {
        if (err.response) { // axios returns error for not 2xx responses - let's unwrap it
          options.callback(null, normalizeResponse(err.response), err.response.data);
        } else {
          options.callback(err, normalizeResponse(null), null);
        }
        return null;
      } else {
        throw err;
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

  if (response) {
    response.body = response.data; // converting axios response body to old expected body attribute
    response.statusCode = response.status; // converting axios status to old expected statusCode
  }

  return response;
}