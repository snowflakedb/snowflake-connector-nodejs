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
 * @param response - axios response object
 * @returns {string}
 */
exports.describeRequestFromResponse = function (response) {
  let methodUppercase = undefined;
  let url = undefined;
  let guid = undefined;
  const responseConfig = response.config;
  if (responseConfig) {
    // Uppercase is used to allow finding logs corresponding to the same request - response pair,
    // by matching identical options' descriptions.
    methodUppercase = responseConfig.method.toUpperCase();
    url = responseConfig.url;
    guid = responseConfig.params?.[sfParams.paramsNames.SF_REQUEST_GUID];
  }
  return exports.describeRequestData({ method: methodUppercase, url: url, guid: guid });
};

exports.describeRequestData = function ({ method, url, guid } = {}) {
  return `[method: ${method}, url: ${url}` + (guid ? `, guid: ${guid}` : '') + ']';
};