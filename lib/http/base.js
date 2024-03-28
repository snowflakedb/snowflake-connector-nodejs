/*
 * Copyright (c) 2015-2024 Snowflake Computing Inc. All rights reserved.
 */

const zlib = require('zlib');
const Util = require('../util');
const Logger = require('../logger');
const axios = require('axios');
const URL = require('node:url').URL;

const DEFAULT_REQUEST_TIMEOUT = 360000;

/**
 * Creates a new HTTP client.
 *
 * @param connectionConfig
 * @constructor
 */
function HttpClient(connectionConfig) {
  // save the connection config
  this._connectionConfig = connectionConfig;
}

/**
 * Issues an HTTP request.
 *
 * @param {Object} options
 *
 * @returns {Object} an object representing the request that was issued.
 */
HttpClient.prototype.request = function (options) {
  let request;
  const requestOptions = prepareRequestOptions.call(this, options);
  let sendRequest = async function sendRequest() {
    request = axios.request(requestOptions).then(response => {
      if (Util.isFunction(options.callback)) {
        return options.callback(null, normalizeResponse(response), response.data);
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

  Logger.getInstance().trace(`CALL ${requestOptions.method} with timeout ${requestOptions.timeout}: ${requestOptions.url}`);
  process.nextTick(sendRequest);

  // return an externalized request object that only contains
  // methods we're comfortable exposing to the outside world
  return {
    abort: function () {
      if (request) {
        request.abort();
      }
    }
  };
};

/**
 * Issues an HTTP request.
 *
 * @param {Object} options
 *
 * @returns {Object} an object representing the request that was issued.
 */
HttpClient.prototype.requestAsync = async function (options) {
  const requestOptions = prepareRequestOptions.call(this, options);

  const response = await axios.request(requestOptions);

  if (Util.isString(response['data']) &&
    response['headers']['content-type'] === 'application/json') {
    response['data'] = JSON.parse(response['data']);
  }

  return response;
};

/**
 * Issues an HTTP POST request.
 *
 * @param {String} url
 * @param {String} body
 * @param {Object} options
 *
 * @returns {Object} an object representing the request that was issued.
 */
HttpClient.prototype.post = async function (url, body, options) {
  return this.requestAsync({
    url: url,
    method: 'POST',
    data: body,
    ...options
  });
};

/**
 * Issues an HTTP GET request.
 *
 * @param {String} url
 * @param {Object} params
 *
 * @returns {Object} an object representing the request that was issued.
 */
HttpClient.prototype.get = async function (url, params) {
  return this.requestAsync({
    url: url,
    method: 'GET',
    ...params,
  });
};

/**
 * Issues an HTTP HEAD request.
 *
 * @param {String} url
 * @param {Object} config
 *
 * @returns {Object} an object representing the request that was issued.
 */
HttpClient.prototype.head = async function (url, config) {
  return this.requestAsync({
    url: url,
    method: 'HEAD',
    ...config
  });
};

/**
 * Issues an HTTP PUT request.
 *
 * @param {String} url
 * @param {Object} data
 * @param {Object} config
 *
 * @returns {Object} an object representing the request that was issued.
 */
HttpClient.prototype.put = async function (url, data, config) {
  return this.requestAsync({
    url: url,
    method: 'PUT',
    data: data,
    ...config
  });
};

/**
 * @abstract
 * Returns the module to use when making HTTP requests. Subclasses must override
 * and provide their own implementations.
 *
 * @returns {*}
 */
HttpClient.prototype.getRequestModule = function () {
  return null;
};

/**
 * Returns the agent and proxy options.
 *
 * @returns {*}
 */
HttpClient.prototype.getAgent = function () {
  return null;
};

module.exports = HttpClient;

function prepareRequestOptions(options) {
  const headers = normalizeHeaders(options.headers) || {};

  const timeout = options.timeout ||
    this._connectionConfig.getTimeout() ||
    DEFAULT_REQUEST_TIMEOUT;

  let data = options.data || options.json;

  if (data) {
    const bufferUncompressed = Buffer.from(JSON.stringify(data), 'utf8');
    zlib.gzip(bufferUncompressed, null, function (err, bufferCompressed) {
      // if the compression was successful
      if (!err) {
        data = bufferCompressed;
        headers['Content-Encoding'] = 'gzip';
      } else {
        Logger.getInstance().warn('Could not compress request data.');
      }
    });
  }

  const params = options.params;

  let mock;
  if (this._connectionConfig.agentClass) {
    mock = {
      agentClass: this._connectionConfig.agentClass
    };
  }
  const backoffStrategy = this.constructExponentialBackoffStrategy();
  const requestOptions =  {
    method: options.method,
    url: options.url,
    headers: headers,
    data: data,
    params: params,
    timeout: timeout,
    requestOCSP: true,
    retryDelay: backoffStrategy,
    rejectUnauthorized: true,
    // we manually parse jsons or other structures from the server so they need to be text
    responseType: options.responseType || 'text',
  };

  const url = new URL(options.url);
  const isHttps = url.protocol === 'https:';
  const agent = this.getAgent(url, this._connectionConfig.getProxy(), mock);
  if (isHttps) {
    requestOptions.httpsAgent = agent;
  } else {
    requestOptions.httpAgent = agent;
  }

  return requestOptions;
}

/**
 * Normalizes a request headers object so that we get the same behavior
 * regardless of whether we're using request.js or browser-request.js.
 *
 * @param {Object} headers
 *
 * @returns {Object}
 */
function normalizeHeaders(headers) {
  let ret = headers;

  if (Util.isObject(headers)) {
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
    let headerNameLowerCase;
    for (const headerName in headers) {
      if (Object.prototype.hasOwnProperty.call(headers, headerName)) {
        headerNameLowerCase = headerName.toLowerCase();
        if ((headerNameLowerCase === 'accept') ||
          (headerNameLowerCase === 'content-type')) {
          ret[headerNameLowerCase] = headers[headerName];
        } else {
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
function normalizeResponse(response) {
  // if the response doesn't already have a getResponseHeader() method, add one
  if (response && !response.getResponseHeader) {
    response.getResponseHeader = function (header) {
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