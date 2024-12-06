const Util = require('../util');

exports.describePresence = function (valueToDescribe) {
  const VAR_PROVIDED_TEXT = 'provided';
  const VAR_NOT_PROVIDED_TEXT = 'not provided';

  return Util.isNotEmptyAsString(valueToDescribe) ? VAR_PROVIDED_TEXT : VAR_NOT_PROVIDED_TEXT;
};

exports.attributesToString = function (sourceObject = {}, attributesWithValueNames = [], attributesWithoutValuesNames = []) {
  // Handle attributes with values, keeping them even if the value is undefined
  const withValues = attributesWithValueNames.map(attr => {
    const value = sourceObject[attr];
    return `${attr}=${value}`; // Always include the pair
  });

  // Handle attributes without values using describePresence
  const withoutValues = attributesWithoutValuesNames.map(attr => {
    const presenceDescription = exports.describePresence(sourceObject[attr]);
    return `${attr} is ${presenceDescription}`;
  });

  return [...withValues, ...withoutValues].join(', ');
};

exports.describeAttributes = function (sourceObject, attributesWithValuesMap, attributesWithoutValuesArray) {
  return `[${exports.attributesToString(sourceObject, attributesWithValuesMap, attributesWithoutValuesArray)}]`;
};
