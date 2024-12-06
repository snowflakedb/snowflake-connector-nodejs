const LoggingUtil = require('../logger/logging_util');
const sfParams = require('../constants/sf_params');

//Initial whitelist
exports.DEFAULT_ATTRIBUTES_DESCRIBING_REQUEST_WITH_VALUES = [
  'baseUrl',
  'path',
  sfParams.paramsNames.SF_REQUEST_GUID,
  sfParams.paramsNames.SF_REQUEST_ID,
];

exports.DEFAULT_ATTRIBUTES_DESCRIBING_REQUEST_WITHOUT_VALUES = [
  'token',
  'x-amz-credential',
];

/**
 * Describes a request based on its options.
 * Should work with not-yet-parsed options as well (before calling prepareRequestOptions method).
 *
 * @param {Object} requestOptions - Object representing the request data with top-level keys.
 * @param {Object} [options] - Options for describing attributes.
 * @param {Array<string>} [options.additionalDescribingAttributes=[]] - Attributes to add to the default set.
 * @param {Array<string>} [options.overrideDescribingAttributes] - Overrides the default set of describing attributes.
 * @returns {string} - A string representation of the request data.
 */
exports.describeRequestFromOptions = function (
  requestOptions,
  { additionalAttributesDescribedWithValues = [], overrideAttributesDescribedWithValues = exports.DEFAULT_ATTRIBUTES_DESCRIBING_REQUEST_WITH_VALUES } = {},
  { additionalAttributesDescribedWithoutValues = [], overrideAttributesDescribedWithoutValues = exports.DEFAULT_ATTRIBUTES_DESCRIBING_REQUEST_WITHOUT_VALUES } = {},
) {
  const describingAttributes = [...overrideDescribingAttributes, ...additionalDescribingAttributes];
  return exports.describeRequestData(
    {
      method: requestOptions.method,
      url: requestOptions.url,
      params: requestOptions.params,
    },
    describingAttributes
  );
};

/**
 * Creates a string that represents request data from a response.
 * Allows identifying the request that was the source of the response.
 * Logs only "white-listed" data (e.g., headers should be explicitly specified if logged).
 *
 * @param {Object} response - Axios response object.
 * @param {Object} [options] - Options for describing attributes.
 * @param {Array<string>} [options.additionalDescribingAttributes=[]] - Attributes to add to the default set.
 * @param {Array<string>} [options.overrideDescribingAttributes] - Overrides the default set of describing attributes.
 * @returns {string} - A string representation of the request data.
 */
exports.describeRequestFromResponse = function (
  response,
  { additionalDescribingAttributes = [], overrideDescribingAttributes = exports.DEFAULT_ATTRIBUTES_DESCRIBING_REQUEST } = {}
) {
  let methodUppercase;
  let url;
  let params;
  const responseConfig = response.config;
  const describingAttributes = [...overrideDescribingAttributes, ...additionalDescribingAttributes];

  if (responseConfig) {
    // Ensure consistent casing for methods to match request-response pairs in logs.
    methodUppercase = responseConfig.method?.toUpperCase();
    url = responseConfig.url;
    params = responseConfig.params;
  }

  return exports.describeRequestData({ method: methodUppercase, url, params }, describingAttributes);
};

/**
 * Constructs a string representation of request data.
 *
 * @param {Object} requestData - Object containing the method, URL, and parameters of the request.
 * @param {string} requestData.method - HTTP method (e.g., GET, POST).
 * @param {string} requestData.url - Request URL.
 * @param {Object} [requestData.params] - Additional query parameters.
 * @param {Array<string>} describingAttributes - List of attributes to include in the description.
 * @returns {string} - A string describing the request data.
 */
exports.describeRequestData = function ({ method, url, params } = {}, describingAttributes) {
  // Parse URL and params into a structured object
  const requestObject = {
    method,
    ...exports.constructURLData(url, params),
  };

  // Use LoggingUtil to describe allowed attributes
  return LoggingUtil.describeAttributes(requestObject, describingAttributes);
};

/**
 * Constructs an object representing URL data including the base URL, path, and query parameters.
 *
 * @param {string} url - The full URL of the request.
 * @param {Object} [params] - Additional query parameters.
 * @returns {Object} - Object containing baseUrl, path, and query parameters.
 */
exports.constructURLData = function (url, params = {}) {
  if (!url) {
    return { baseUrl: '', path: '', queryParams: {} };
  }

  const urlObj = new URL(url); // Parse the URL
  const queryParams = { ...params }; // Clone existing params

  // Merge URL search params with existing params
  urlObj.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  // Combine protocol, hostname, and port into a single string
  const baseUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? `:${urlObj.port}` : ''}`;

  // Return structured URL data
  return {
    baseUrl, // Combined protocol, hostname, and port
    path: urlObj.pathname,
    ...queryParams, // All query parameters as a nested object
  };
};
