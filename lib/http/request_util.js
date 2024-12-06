const LoggingUtil = require('../logger/logging_util');
const sfParams = require('../constants/sf_params');

/**
 * Should work with not yet parsed options as well (before calling prepareRequestOptions method).
 *
 * @param requestOptions - object representing the request data with top-level keys
 * @returns {string}
 */
exports.describeRequestFromOptions = function (requestOptions) {
  return exports.describeRequestData({ method: requestOptions.method, url: requestOptions.url, guid: requestOptions.params?.[sfParams.paramsNames.SF_REQUEST_GUID] });
};

/**
 * Creates string that represents response data.
 * Should allow to identify request, which was the source for this response.
 * Serves as a 'white-list' of data that should be logged - e.g. if any headers were to be logged it should be specified here.
 *
 * @param response - axios response object
 * @param includedParams
 * @returns {string}
 */
exports.describeRequestFromResponse = function (response, {includedParams = []} = {}) {
  let methodUppercase = undefined;
  let url = undefined;
  let params = undefined;
  const responseConfig = response.config;
  if (responseConfig) {
    // Uppercase is used to allow finding logs corresponding to the same request - response pair,
    // by matching identical options' descriptions.
    methodUppercase = responseConfig.method.toUpperCase();
    url = responseConfig.url;
    params = responseConfig.params;
  }
  return exports.describeRequestData({ method: methodUppercase, url: url, params: params }, includedParams);
};

exports.describeRequestData = function ({ method, url, params } = {}, includedParams) {
  //TODO: clear url
  const requestObject = {
    method: method,
    ...exports.constructURLData(url, params)
  };
  return LoggingUtil.describeAttributes(requestObject, includedParams);
};

//TODO: add descriptions
exports.constructURLData = function (url, params) {
  const urlObj = new URL(url); // Create a URL object for parsing
  const queryParams = params || {};

  // Extract query parameters into an object
  urlObj.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  // Combine protocol, hostname, and port into baseUrl
  const baseUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? `:${urlObj.port}` : ''}`;

  // Build the result object
  return {
    baseUrl, // Combined protocol, hostname, and port
    path: urlObj.pathname,
    ...queryParams, // Include parsed query parameters
  };
}
