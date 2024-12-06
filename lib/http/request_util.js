const LoggingUtil = require('../logger/logging_util');
const sfParams = require('../constants/sf_params');

// Initial whitelist for attributes - they will be described with values
exports.DEFAULT_ATTRIBUTES_DESCRIBING_REQUEST_WITH_VALUES = [
  'baseUrl',
  'path',
  sfParams.paramsNames.SF_REQUEST_ID,
  sfParams.paramsNames.SF_REQUEST_GUID,
  sfParams.paramsNames.SF_WAREHOUSE_NAME,
  sfParams.paramsNames.SF_DB_NAME,
  sfParams.paramsNames.SF_SCHEMA_NAME,
];

// Initial blacklist for attributes - described as present/not present only
exports.DEFAULT_ATTRIBUTES_DESCRIBING_REQUEST_WITHOUT_VALUES = [
  sfParams.paramsNames.SF_TOKEN
];

/**
 * Describes a request based on its options.
 * Should work with not-yet-parsed options as well (before calling prepareRequestOptions method).
 *
 * @param {Object} requestOptions - Object representing the request data with top-level keys.
 * @param {Object} [options] - Options for describing attributes.
 * @param {Array<string>} [options.additionalAttributesDescribedWithValues]
 * @param {Array<string>} [options.overrideAttributesDescribedWithValues]
 * @param {Array<string>} [options.additionalAttributesDescribedWithoutValues]
 * @param {Array<string>} [options.overrideAttributesDescribedWithoutValues]
 * @returns {string} A string representation of the request data.
 */
exports.describeRequestFromOptions = function (
  requestOptions,
  {
    additionalAttributesDescribedWithValues = [],
    overrideAttributesDescribedWithValues,
    additionalAttributesDescribedWithoutValues = [],
    overrideAttributesDescribedWithoutValues
  } = {}
) {
  const describingAttributesWithValues = mergeAttributeLists(
    exports.DEFAULT_ATTRIBUTES_DESCRIBING_REQUEST_WITH_VALUES,
    overrideAttributesDescribedWithValues,
    additionalAttributesDescribedWithValues
  );

  const describingAttributesWithoutValues = mergeAttributeLists(
    exports.DEFAULT_ATTRIBUTES_DESCRIBING_REQUEST_WITHOUT_VALUES,
    overrideAttributesDescribedWithoutValues,
    additionalAttributesDescribedWithoutValues
  );

  const { method, url, params } = requestOptions || {};

  return exports.describeRequestData(
    { method, url, params },
    describingAttributesWithValues,
    describingAttributesWithoutValues
  );
};

/**
 * Creates a string that represents request data from a response.
 * Helps to identify the request that was the source of the response.
 *
 * @param {Object} response - Axios response object.
 * @param {Object} [options] - Options for describing attributes.
 * @param {Array<string>} [options.additionalAttributesDescribedWithValues]
 * @param {Array<string>} [options.overrideAttributesDescribedWithValues]
 * @param {Array<string>} [options.additionalAttributesDescribedWithoutValues]
 * @param {Array<string>} [options.overrideAttributesDescribedWithoutValues]
 * @returns {string} A string representation of the request data.
 */
exports.describeRequestFromResponse = function (
  response,
  {
    additionalAttributesDescribedWithValues = [],
    overrideAttributesDescribedWithValues,
    additionalAttributesDescribedWithoutValues = [],
    overrideAttributesDescribedWithoutValues
  } = {}
) {
  let methodUppercase;
  let url;
  let params;
  const responseConfig = response.config;

  const describingAttributesWithValues = mergeAttributeLists(
    exports.DEFAULT_ATTRIBUTES_DESCRIBING_REQUEST_WITH_VALUES,
    overrideAttributesDescribedWithValues,
    additionalAttributesDescribedWithValues
  );

  const describingAttributesWithoutValues = mergeAttributeLists(
    exports.DEFAULT_ATTRIBUTES_DESCRIBING_REQUEST_WITHOUT_VALUES,
    overrideAttributesDescribedWithoutValues,
    additionalAttributesDescribedWithoutValues
  );

  if (responseConfig) {
    // Ensure consistent casing for methods to match request-response pairs in logs.
    methodUppercase = responseConfig.method?.toUpperCase();
    url = responseConfig.url;
    params = responseConfig.params;
  }

  return exports.describeRequestData(
    { method: methodUppercase, url, params },
    describingAttributesWithValues,
    describingAttributesWithoutValues
  );
};

/**
 * Constructs a string representation of request data.
 *
 * @param {Object} requestData - Object containing the method, url, and parameters.
 * @param {string} requestData.method - HTTP method.
 * @param {string} requestData.url - Request URL.
 * @param {Object} [requestData.params] - Additional query parameters.
 * @param {Array<string>} attributesWithValues - Attributes to describe with values.
 * @param {Array<string>} attributesWithoutValues - Attributes to describe without values.
 * @returns {string} A string describing the request data.
 */
exports.describeRequestData = function (
  { method, url, params } = {},
  attributesWithValues,
  attributesWithoutValues
) {
  const requestObject = {
    method,
    ...exports.constructURLData(url, params),
  };

  return LoggingUtil.describeAttributes(
    requestObject,
    attributesWithValues,
    attributesWithoutValues
  );
};

/**
 * Constructs an object representing URL data including the base URL, path, and query parameters.
 *
 * @param {string} url - The full URL.
 * @param {Object} [params] - Additional query parameters.
 * @returns {Object} Contains baseUrl, path, and merged query parameters.
 */
exports.constructURLData = function (url, params = {}) {
  if (!url) {
    return { baseUrl: '', path: '', queryParams: {} };
  }

  const urlObj = new URL(url);
  const queryParams = { ...params };

  urlObj.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });

  const baseUrl = `${urlObj.protocol}//${urlObj.hostname}${urlObj.port ? `:${urlObj.port}` : ''}`;

  return {
    baseUrl: baseUrl,
    path: urlObj.pathname,
    ...queryParams,
  };
};

/**
 * @param {string} url - The URL to describe.
 * @param {Object} [options] - Options for describing attributes.
 * @param {Array<string>} [options.additionalAttributesDescribedWithValues]
 * @param {Array<string>} [options.overrideAttributesDescribedWithValues]
 * @param {Array<string>} [options.additionalAttributesDescribedWithoutValues]
 * @param {Array<string>} [options.overrideAttributesDescribedWithoutValues]
 * @returns {string} A string describing the URL.
 */
exports.describeURL = function (
  url,
  {
    additionalAttributesDescribedWithValues = [],
    overrideAttributesDescribedWithValues,
    additionalAttributesDescribedWithoutValues = [],
    overrideAttributesDescribedWithoutValues
  } = {}
) {
  const describingAttributesWithValues = mergeAttributeLists(
    exports.DEFAULT_ATTRIBUTES_DESCRIBING_REQUEST_WITH_VALUES,
    overrideAttributesDescribedWithValues,
    additionalAttributesDescribedWithValues
  );

  const describingAttributesWithoutValues = mergeAttributeLists(
    exports.DEFAULT_ATTRIBUTES_DESCRIBING_REQUEST_WITHOUT_VALUES,
    overrideAttributesDescribedWithoutValues,
    additionalAttributesDescribedWithoutValues
  );

  const urlData = exports.constructURLData(url);

  return LoggingUtil.describeAttributes(
    urlData,
    describingAttributesWithValues,
    describingAttributesWithoutValues
  );
};

// Helper function to merge attribute arrays.
function mergeAttributeLists(defaultAttrs, overrideAttrs, additionalAttrs) {
  const base = overrideAttrs || defaultAttrs;
  return [...base, ...additionalAttrs];
}
