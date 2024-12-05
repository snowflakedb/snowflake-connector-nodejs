
/**
 * Should work with not yet parsed options as well (before calling prepareRequestOptions method).
 *
 * @param requestOptions - object representing the request data with top-level keys
 * @returns {string}
 */
exports.describeRequestFromOptions = function (requestOptions) {
  return exports.describeRequestData({ method: requestOptions.method, url: requestOptions.url });
};

/**
 * Creates string that represents response data.
 * Should allow to identify request, which was the source for this response.
 * @param response - axios response object
 * @returns {string}
 */
exports.describeRequestFromResponse = function (response) {
  // Uppercase is used to allow finding logs corresponding to the same request - response pair,
  // by matching identical options' descriptions.
  return exports.describeRequestData({ method: response.config?.method.toUpperCase(), url: response.config?.url });
};

exports.describeRequestData = function (requestData) {
  return `[method: ${requestData.method}, url: ${requestData.url}]`;
};