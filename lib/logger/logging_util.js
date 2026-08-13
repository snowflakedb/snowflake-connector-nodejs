const Util = require('../util');

const PROVIDED_TEXT = 'provided';
const NOT_PROVIDED_TEXT = 'not provided';
const NO_HEADERS_TEXT = 'none';

/**
 * Describes the presence of a given value. If the value is not empty (as a string),
 * returns the corresponding text (by default: 'provided' or 'not provided').
 *
 * @param {*} valueToDescribe - The value to check for presence.
 * @param {Object} [options] - Optional overrides for the "provided" and "not provided" text.
 * @param {string} [options.overrideProvidedText]
 * @param {string} [options.overrideNotProvidedText]
 * @returns {string} A string indicating the presence of `valueToDescribe`.
 */
exports.describePresence = function (
  valueToDescribe,
  { overrideProvidedText, overrideNotProvidedText } = {},
) {
  const providedText = overrideProvidedText || PROVIDED_TEXT;
  const notProvidedText = overrideNotProvidedText || NOT_PROVIDED_TEXT;
  return Util.isNotEmptyAsString(valueToDescribe) ? providedText : notProvidedText;
};

/**
 * @param {Object} sourceObject - The object holding attribute values.
 * @param {Array<string>} attributesWithValues - Attributes to show with their values.
 * @param {Array<string>} attributesWithoutValues - Attributes to show as present/not present.
 * @returns {string} Comma-separated string describing the attributes.
 */
exports.attributesToString = function (
  sourceObject = {},
  attributesWithValues = [],
  attributesWithoutValues = [],
) {
  const withValues = attributesWithValues
    .filter((attr) => sourceObject[attr] !== undefined)
    .map((attr) => `${attr}=${String(sourceObject[attr])}`);

  const withoutValues = attributesWithoutValues
    .filter((attr) => sourceObject[attr] !== undefined)
    .map((attr) => `${attr} is ${exports.describePresence(sourceObject[attr])}`);

  return [...withValues, ...withoutValues].join(', ');
};

/**
 * @param {Object} sourceObject - The object holding attribute values.
 * @param {Array<string>} attributesWithValues - Attributes to show with their values.
 * @param {Array<string>} attributesWithoutValues - Attributes to show as present/not present.
 * @returns {string} A bracketed string of described attributes.
 */
exports.describeAttributes = function (
  sourceObject,
  attributesWithValues,
  attributesWithoutValues,
) {
  const attributesDescription = exports.attributesToString(
    sourceObject,
    attributesWithValues,
    attributesWithoutValues,
  );
  return `[${attributesDescription}]`;
};

/**
 * Describes a set of HTTP headers by listing their names only. Header values can
 * carry credential material (session tokens, encryption keys, cookies), so they
 * must never reach the logs.
 *
 * Works with any header container whose own enumerable properties are the header
 * names - both the plain objects the driver builds for requests and the
 * AxiosHeaders instances axios attaches to responses.
 *
 * @param {Object} [headers] - The headers to describe, may be missing or empty.
 * @returns {string} Comma-separated header names in alphabetical order, or
 * 'none' when there is nothing to describe.
 */
exports.headerNames = function (headers) {
  if (!headers || typeof headers !== 'object') {
    return NO_HEADERS_TEXT;
  }
  const names = Object.keys(headers).sort();
  return names.length === 0 ? NO_HEADERS_TEXT : names.join(', ');
};

/**
 * @param {string} url - The URL to strip the query string from.
 * @returns {string} The URL without the query string.
 */
exports.stripQueryString = function (url) {
  if (!url) {
    return url;
  }
  return url ? url.split('?')[0] : url;
};
