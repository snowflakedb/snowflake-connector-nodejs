const LoggingUtil = require('../logger/logging_util');
const sfParams = require('../constants/sf_params');

// Initial whitelist for attributes - they will be described with values
exports.DEFAULT_ATTRIBUTES_DESCRIBING_REQUEST_WITH_VALUES = [
  'baseUrl',
  'path',
  sfParams.paramsNames.SF_REQUEST_ID,
  sfParams.paramsNames.SF_REQUEST_GUID,
];

// Initial blacklist for attributes - they will be only described as present or not
exports.DEFAULT_ATTRIBUTES_DESCRIBING_REQUEST_WITHOUT_VALUES = [
  sfParams.paramsNames.SF_TOKEN
];

/**
 * Describes a request based on its options.
 * Should work with not-yet-parsed options as well (before calling prepareRequestOptions method).
 *
 * @param {Object} requestOptions - Object representing the request data with top-level keys.
 * @param {Object} [options] - Options for describing attributes.
 * @param {Array<string>} [options.additionalAttributesDescribedWithValues] - Attributes to add to the default set of describing attributes with values.
 * @param {Array<string>} [options.overrideAttributesDescribedWithValues] - Overrides the default set of describing attributes with values.
 * @param {Array<string>} [options.additionalAttributesDescribedWithoutValues] - Attributes to add to the default set without values.
 * @param {Array<string>} [options.overrideAttributesDescribedWithoutValues] - Overrides the default set of describing attributes without values.
 * @returns {string} - A string representation of the request data.
 */
exports.describeRequestFromOptions = function (
  requestOptions,
  {
    additionalAttributesDescribedWithValues = [],
    overrideAttributesDescribedWithValues = exports.DEFAULT_ATTRIBUTES_DESCRIBING_REQUEST_WITH_VALUES,
    additionalAttributesDescribedWithoutValues = [],
    overrideAttributesDescribedWithoutValues = exports.DEFAULT_ATTRIBUTES_DESCRIBING_REQUEST_WITHOUT_VALUES,
  } = {}
) {
  const describingAttributesWithValues = [
    ...overrideAttributesDescribedWithValues,
    ...additionalAttributesDescribedWithValues,
  ];
  const describingAttributesWithoutValues = [
    ...overrideAttributesDescribedWithoutValues,
    ...additionalAttributesDescribedWithoutValues,
  ];

  return exports.describeRequestData(
    {
      method: requestOptions.method,
      url: requestOptions.url,
      params: requestOptions.params,
    },
    describingAttributesWithValues,
    describingAttributesWithoutValues
  );
};

/**
 * Creates a string that represents request data from a response.
 * Allows identifying the request that was the source of the response.
 * Logs only "white-listed" data (e.g., headers should be explicitly specified if logged).
 *
 * @param {Object} response - Axios response object.
 * @param {Object} [options] - Options for describing attributes.
 * @param {Array<string>} [options.additionalAttributesDescribedWithValues] - Attributes to add to the default set of describing attributes with values.
 * @param {Array<string>} [options.overrideAttributesDescribedWithValues] - Overrides the default set of describing attributes with values.
 * @param {Array<string>} [options.additionalAttributesDescribedWithoutValues] - Attributes to add to the default set without values.
 * @param {Array<string>} [options.overrideAttributesDescribedWithoutValues] - Overrides the default set of describing attributes without values.
 * @returns {string} - A string representation of the request data.
 */
exports.describeRequestFromResponse = function (
  response,
  {
    additionalAttributesDescribedWithValues = [],
    overrideAttributesDescribedWithValues = exports.DEFAULT_ATTRIBUTES_DESCRIBING_REQUEST_WITH_VALUES,
    additionalAttributesDescribedWithoutValues = [],
    overrideAttributesDescribedWithoutValues = exports.DEFAULT_ATTRIBUTES_DESCRIBING_REQUEST_WITHOUT_VALUES,
  } = {}
) {
  let methodUppercase;
  let url;
  let params;
  const responseConfig = response.config;

  const describingAttributesWithValues = [
    ...overrideAttributesDescribedWithValues,
    ...additionalAttributesDescribedWithValues,
  ];
  const describingAttributesWithoutValues = [
    ...overrideAttributesDescribedWithoutValues,
    ...additionalAttributesDescribedWithoutValues,
  ];

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
 * @param {Object} requestData - Object containing the method, URL, and parameters of the request.
 * @param {string} requestData.method - HTTP method (e.g., GET, POST).
 * @param {string} requestData.url - Request URL.
 * @param {Object} [requestData.params] - Additional query parameters.
 * @param {Array<string>} attributesWithValues - Attributes to describe with values.
 * @param {Array<string>} attributesWithoutValues - Attributes to describe without values.
 * @returns {string} - A string describing the request data.
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
 * @param {string} url - The full URL of the request.
 * @param {Object} [params] - Additional query parameters.
 * @returns {Object} - Object containing baseUrl, path, and query parameters.
 */
exports.constructURLData = function (url, params = {}) {
  if (!url) {
    return { baseUrl: '', path: '', queryParams: {} };
  }

  const urlObj = new URL(url);
  const queryParams = { ...params };

  // Merge URL search params with existing params
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
