const Util = require('../util');

const PROVIDED_TEXT = 'provided';
const NOT_PROVIDED_TEXT = 'not provided';

exports.describePresence = function (valueToDescribe) {
  return Util.isNotEmptyAsString(valueToDescribe) ? PROVIDED_TEXT : NOT_PROVIDED_TEXT;
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
  attributesWithoutValues = []
) {
  const withValues = attributesWithValues
    .filter(attr => sourceObject[attr] !== undefined)
    .map(attr => `${attr}=${String(sourceObject[attr])}`);

  const withoutValues = attributesWithoutValues
    .map(attr => `${attr} is ${exports.describePresence(sourceObject[attr])}`);

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
  attributesWithoutValues
) {
  const attributesDescription = exports.attributesToString(
    sourceObject,
    attributesWithValues,
    attributesWithoutValues
  );
  return `[${attributesDescription}]`;
};
